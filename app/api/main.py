from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import fitz  # PyMuPDF
import os
from datetime import datetime
import shutil
from langchain_openai import OpenAI  # Updated import
from langchain.chains.question_answering import load_qa_chain
from langchain.docstore.document import Document
import logging

# Initialize FastAPI app
app = FastAPI()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this to allow specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database setup
DATABASE_URL = "sqlite:///./test.db"
Base = declarative_base()
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class DocumentMetadata(Base):
    __tablename__ = "documents"
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    upload_date = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)

# File storage setup
UPLOAD_FOLDER = "./uploads"
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# LangChain setup
llm = OpenAI(api_key="sk-proj-g9XlIJsqNu62XzqmaCfJT3BlbkFJIfFXzt2Fh6CmTg8GwWBP")  # Replace with your API key
qa_chain = load_qa_chain(llm)

# PDF Upload endpoint
@app.post("/upload/")
async def upload_pdf(file: UploadFile = File(...)):
    try:
        if file.content_type != "application/pdf":
            raise HTTPException(status_code=400, detail="Invalid file type")
        
        file_location = f"{UPLOAD_FOLDER}/{file.filename}"
        with open(file_location, "wb+") as file_object:
            shutil.copyfileobj(file.file, file_object)
        
        # Extract text from PDF
        doc = fitz.open(file_location)
        text = ""
        for page in doc:
            text += page.get_text()
        
        # Save document info to DB
        db = SessionLocal()
        doc_entry = DocumentMetadata(filename=file.filename)
        db.add(doc_entry)
        db.commit()
        db.refresh(doc_entry)
        
        logger.info(f"Uploaded PDF: {file.filename}, Extracted text length: {len(text)}")
        # Return response
        return JSONResponse(status_code=200, content={"id": doc_entry.id, "filename": file.filename, "text": text})
    except Exception as e:
        logger.error(f"Error uploading PDF: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

# Question endpoint
class Question(BaseModel):
    question: str
    document_id: int

@app.post("/ask/")
async def ask_question(question: Question):
    try:
        db = SessionLocal()
        document = db.query(DocumentMetadata).filter(DocumentMetadata.id == question.document_id).first()
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        file_location = f"{UPLOAD_FOLDER}/{document.filename}"
        doc = fitz.open(file_location)
        text = ""
        for page in doc:
            text += page.get_text()

        logger.info(f"Processing question: {question.question} for document: {document.filename}")
        
        # Convert text to LangChain Document format
        langchain_document = Document(page_content=text, metadata={"source": file_location})
        
        # Process question with LangChain using invoke method
        response = qa_chain.invoke({"input_documents": [langchain_document], "question": question.question})
        answer_text = response["output_text"]
        
        logger.info(f"Generated answer: {answer_text}")
        
        return JSONResponse(status_code=200, content={"answer": answer_text})
    except Exception as e:
        logger.error(f"Error processing question: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

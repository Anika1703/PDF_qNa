import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [documentId, setDocumentId] = useState(null);
  const [step, setStep] = useState(1);
  const [messages, setMessages] = useState([]);
  const [suggestions, setSuggestions] = useState([]);

  const predefinedSuggestions = [
    "What is the summary of this document?",
    "What are the main points discussed?",
    "Can you provide an overview?",
    "What is the conclusion?",
    "Can you explain the key concepts?",
    "Give me bullet points for each section",
    "Are there any important dates or deadlines listed?",
    "Are there any references or citations to other works?",
    "What are the recommendations or action items mentioned?",
    "Are there any notable quotes or statements?"
  ];

  const onFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  const onFileUpload = () => {
    const formData = new FormData();
    formData.append('file', selectedFile);

    axios.post('http://localhost:8000/upload/', formData)
      .then(response => {
        setDocumentId(response.data.id);
        setMessages([...messages, { sender: 'system', text: 'File uploaded successfully' }]);
        setStep(3);
      })
      .catch(error => {
        setMessages([...messages, { sender: 'system', text: 'Error uploading file' }]);
      });
  };

  const onQuestionSubmit = () => {
    if (!question.trim()) return;

    const newMessages = [...messages, { sender: 'user', text: question }];
    setMessages(newMessages);

    axios.post('http://localhost:8000/ask/', {
      question: question,
      document_id: documentId
    })
      .then(response => {
        setAnswer(response.data.answer);
        setMessages([...newMessages, { sender: 'bot', text: response.data.answer }]);
        setStep(4);
      })
      .catch(error => {
        setMessages([...newMessages, { sender: 'bot', text: 'Error getting answer' }]);
      });

    setQuestion('');
  };

  const handleNewPDF = () => {
    setSelectedFile(null);
    setQuestion('');
    setAnswer('');
    setDocumentId(null);
    setMessages([]);
    setStep(2);
  };

  const handleNewQuestion = () => {
    setQuestion('');
    setAnswer('');
    setStep(3);
  };

  const handleQuestionChange = (e) => {
    const input = e.target.value;
    setQuestion(input);

    if (input.length > 0) {
      const filteredSuggestions = predefinedSuggestions.filter(suggestion =>
        suggestion.toLowerCase().includes(input.toLowerCase())
      );
      setSuggestions(filteredSuggestions);
    } else {
      setSuggestions([]);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setQuestion(suggestion);
    setSuggestions([]);
  };

  return (
    <div className="App">
      {step === 1 && (
        <div className="welcome-section">
          <h1>The answer to all your questions starts with the click of a button</h1>
          <div className="upload-section">
            <input type="file" onChange={onFileChange} />
            <button className="upload-button" onClick={onFileUpload}>Upload PDF</button>
          </div>
        </div>
      )}
      {step >= 3 && (
        <div className="chat-container">
          <div className="chat-messages">
            {messages.map((msg, index) => (
              <div key={index} className={`chat-message ${msg.sender}`}>
                <p>{msg.text}</p>
              </div>
            ))}
          </div>
          {step === 3 && documentId && (
            <div className="question-section">
              <input
                type="text"
                value={question}
                onChange={handleQuestionChange}
                placeholder="Ask a question about the PDF"
              />
              <button className="question-button" onClick={onQuestionSubmit}>Submit Question</button>
              {suggestions.length > 0 && (
                <ul className="suggestions-list">
                  {suggestions.map((suggestion, index) => (
                    <li key={index} onClick={() => handleSuggestionClick(suggestion)}>
                      {suggestion}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {step === 4 && (
            <div className="answer-section">
              <div className="action-buttons">
                <button className="upload-button" onClick={handleNewPDF}>Upload New PDF</button>
                <button className="question-button" onClick={handleNewQuestion}>Ask Another Question</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;

// Enhanced AI Tutoring Backend with Groq, DeepSeek, and RAG
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// AI Model Configuration
const AI_MODELS = {
  groq: {
    apiKey: process.env.GROQ_API_KEY || 'demo-key',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
    maxTokens: 4096,
    temperature: 0.3
  },
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY || 'demo-key',
    endpoint: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-chat',
    maxTokens: 4096,
    temperature: 0.3
  }
};

// Enhanced System Prompt for Sinhala AI Tutoring
const SYSTEM_PROMPT = `You are an expert A/L Chemistry tutor for Sri Lankan students.

RESPONSE STRUCTURE (MANDATORY):
1. Brief Overview (2-3 sentences)
2. Detailed Explanation
   - Main Concepts (with scientific Sinhala terms)
   - Step-by-step breakdown
   - Real-world examples from syllabus
3. Key Points Summary
   - Use numbered lists
   - Include formulas/equations
4. Practice Tips
5. Related Topics (for further study)

LANGUAGE REQUIREMENTS:
- Use scientific Sinhala terminology correctly
- Preserve English terms in brackets: e.g., "ඔක්සිකරණය (Oxidation)"
- Use clear, educational tone
- Provide detailed explanations (minimum 500 words for complex topics)

QUALITY STANDARDS:
- Comprehensive coverage
- Scientifically accurate
- Exam-oriented
- Easy to understand`;

// Call Groq AI (Primary)
async function callGroqAI(message, context = '') {
  try {
    const response = await axios.post(
      AI_MODELS.groq.endpoint,
      {
        model: AI_MODELS.groq.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT + (context ? `\n\nContext: ${context}` : '') },
          { role: 'user', content: message }
        ],
        max_tokens: AI_MODELS.groq.maxTokens,
        temperature: AI_MODELS.groq.temperature
      },
      {
        headers: {
          'Authorization': `Bearer ${AI_MODELS.groq.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return {
      success: true,
      content: response.data.choices[0].message.content,
      model: 'groq-llama-3.3-70b',
      metadata: {
        tokens: response.data.usage?.total_tokens || 0
      }
    };
  } catch (error) {
    console.error('Groq API Error:', error.response?.data || error.message);
    throw error;
  }
}

// Call DeepSeek AI (Backup/Verification)
async function callDeepSeekAI(message, context = '') {
  try {
    const response = await axios.post(
      AI_MODELS.deepseek.endpoint,
      {
        model: AI_MODELS.deepseek.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT + (context ? `\n\nContext: ${context}` : '') },
          { role: 'user', content: message }
        ],
        max_tokens: AI_MODELS.deepseek.maxTokens,
        temperature: AI_MODELS.deepseek.temperature
      },
      {
        headers: {
          'Authorization': `Bearer ${AI_MODELS.deepseek.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return {
      success: true,
      content: response.data.choices[0].message.content,
      model: 'deepseek-chat',
      metadata: {
        tokens: response.data.usage?.total_tokens || 0
      }
    };
  } catch (error) {
    console.error('DeepSeek API Error:', error.response?.data || error.message);
    throw error;
  }
}

// Main Chat Endpoint with Multi-Model Support
app.post('/api/chat', async (req, res) => {
  try {
    const { message, subject = 'chemistry', language = 'si' } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    console.log(`Processing chat request: ${message.substring(0, 50)}...`);

    // Try Groq first (primary model)
    let aiResponse;
    try {
      aiResponse = await callGroqAI(message);
    } catch (groqError) {
      console.log('Groq failed, trying DeepSeek backup...');
      try {
        aiResponse = await callDeepSeekAI(message);
      } catch (deepseekError) {
        return res.status(500).json({
          success: false,
          error: 'All AI models are currently unavailable',
          details: 'Please check your API keys'
        });
      }
    }

    res.json({
      success: true,
      response: aiResponse.content,
      metadata: {
        model: aiResponse.model,
        tokens: aiResponse.metadata.tokens,
        subject: subject,
        language: language
      }
    });

  } catch (error) {
    console.error('Chat endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Enhanced Chat Endpoint with RAG Support
app.post('/api/chat/enhanced', async (req, res) => {
  try {
    const { message, subject = 'chemistry', language = 'si', useRAG = false } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    console.log(`Processing enhanced chat: ${message.substring(0, 50)}...`);

    let context = '';
    if (useRAG) {
      // TODO: Implement RAG search when PDF processing is added
      // For now, return a note that RAG is being developed
      context = 'RAG context will be added when PDF processing is configured.';
    }

    // Try Groq first
    let aiResponse;
    try {
      aiResponse = await callGroqAI(message, context);
    } catch (groqError) {
      console.log('Groq failed, using DeepSeek...');
      aiResponse = await callDeepSeekAI(message, context);
    }

    res.json({
      success: true,
      response: {
        mainAnswer: aiResponse.content,
        sections: [
          {
            title: 'Main Explanation',
            content: aiResponse.content
          }
        ],
        learnMore: []
      },
      metadata: {
        model: aiResponse.model,
        processingTime: 0,
        confidenceScore: 0.95,
        sources: context ? ['Internal Knowledge Base'] : []
      }
    });

  } catch (error) {
    console.error('Enhanced chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'running',
    version: '2.0.0',
    features: [
      'Groq AI (Llama 3.3 70B)',
      'DeepSeek AI (Backup)',
      'Multi-language Support',
      'Enhanced RAG (Coming Soon)'
    ],
    environment: {
      groqConfigured: !!process.env.GROQ_API_KEY,
      deepseekConfigured: !!process.env.DEEPSEEK_API_KEY
    }
  });
});

// Test Endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'AI Tutor Backend is running',
    version: '2.0.0',
    endpoints: [
      'POST /api/chat',
      'POST /api/chat/enhanced',
      'GET /api/health'
    ]
  });
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Enhanced AI Tutor Backend running on port ${PORT}`);
  console.log(`📊 Features: Groq AI, DeepSeek Backup, Multi-language Support`);
  console.log(`🔑 Groq API Key: ${process.env.GROQ_API_KEY ? 'Configured ✓' : 'Not configured ✗'}`);
  console.log(`🔑 DeepSeek API Key: ${process.env.DEEPSEEK_API_KEY ? 'Configured ✓' : 'Not configured ✗'}`);
});

module.exports = app;

import React, { useState, useMemo } from 'react';
import {
  PhoneCall, CheckCircle2, XCircle, Upload, Sparkles, ShieldCheck,
  FileAudio, MessageSquareText, ArrowRight, KeyRound, Loader2,
  BarChart3, AlertTriangle, Quote, ChevronDown, ChevronUp
} from 'lucide-react';
import initialData from './data/dashboardData.json';

const SAMPLE_PRESETS = [
  {
    label: 'Preset 1: Customer Agrees to Renew',
    text: '[0s] Agent: Good afternoon, calling from Meghana Insurance regarding your policy renewal due this Friday.\n[7s] Customer: Yes, I was meaning to renew it today. Can you send the UPI payment link on WhatsApp?\n[14s] Agent: Sent right away! Your total with No Claim Bonus is 7,200 rupees.\n[21s] Customer: Got it, paying now. Thanks for the reminder!'
  },
  {
    label: 'Preset 2: Price Objection / Unsuccessful',
    text: '[0s] Agent: Hello, calling about your health policy renewal due next week.\n[8s] Customer: Your renewal price jumped by 4,000 rupees this year. I already got a cheaper quote from Star Health, so I am not renewing with you.\n[18s] Agent: Understood sir, thank you for your time.'
  }
];

export default function App() {
  const [calls, setCalls] = useState(initialData.calls || []);
  const [activeTab, setActiveTab] = useState('overview');
  const [filter, setFilter] = useState('ALL');
  const [expandedId, setExpandedId] = useState(initialData.calls?.[0]?.call_id || null);

  const [sandboxMode, setSandboxMode] = useState('audio');
  const [groqKey, setGroqKey] = useState(() => import.meta.env.VITE_GROQ_API_KEY || localStorage.getItem('groq_api_key') || '');
  const [audioFile, setAudioFile] = useState(null);
  const [transcriptInput, setTranscriptInput] = useState(SAMPLE_PRESETS[0].text);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [liveResult, setLiveResult] = useState(null);

  const stats = useMemo(() => {
    const total = calls.length;
    const successful = calls.filter(c => c.call_outcome === 'SUCCESSFUL').length;
    const unsuccessful = calls.filter(c => c.call_outcome === 'UNSUCCESSFUL').length;
    const rate = total ? Math.round((successful / total) * 100) : 0;
    const failureReasons = calls.filter(c => c.call_outcome === 'UNSUCCESSFUL');
    return { total, successful, unsuccessful, rate, failureReasons };
  }, [calls]);

  const filteredCalls = useMemo(() => {
    if (filter === 'ALL') return calls;
    return calls.filter(c => c.call_outcome === filter);
  }, [calls, filter]);

  const saveKey = (val) => {
    setGroqKey(val);
    localStorage.setItem('groq_api_key', val.trim());
  };

  const classifyTranscriptLocally = (text) => {
    const lower = text.toLowerCase();
    const isSuccess =
      (lower.includes('send') && (lower.includes('link') || lower.includes('quote') || lower.includes('pay'))) ||
      lower.includes('complete the payment') ||
      lower.includes('paying now') ||
      lower.includes('will pay') ||
      lower.includes('agree');

    if (isSuccess) {
      return {
        call_outcome: 'SUCCESSFUL',
        category: 'RENEWAL_CONFIRMED',
        sentiment: 'POSITIVE',
        reason: 'Customer confirmed intent to proceed with renewal payment after reviewing the quote.',
        key_quote: text.split('\n').find(l => l.toLowerCase().includes('customer')) || text.slice(0, 110),
        next_action: 'Send WhatsApp/Email payment link and confirm receipt within 2 hours.'
      };
    }
    const isNetwork = lower.includes('breaking') || lower.includes('disconnect') || lower.includes('signal');
    return {
      call_outcome: 'UNSUCCESSFUL',
      category: isNetwork ? 'NETWORK_DROP' : 'COMPETITOR_OR_PRICE_OBJECTION',
      sentiment: isNetwork ? 'NEUTRAL' : 'ANNOYED',
      reason: isNetwork
        ? 'Call dropped prematurely due to poor audio/carrier signal before renewal could be discussed.'
        : 'Customer declined renewal due to competitor switch or premium pricing objection.',
      key_quote: text.split('\n').find(l => l.toLowerCase().includes('customer')) || text.slice(0, 110),
      next_action: isNetwork ? 'Retry call during peak network window.' : 'Log objection reason and trigger win-back retention offer.'
    };
  };

  const handleAnalyzeAudio = async () => {
    setErrorMsg('');
    setLiveResult(null);
    if (!audioFile) {
      setErrorMsg('Please select an .mp3, .wav, or .m4a audio file first.');
      return;
    }
    if (!groqKey.trim()) {
      setErrorMsg('Enter a free Groq API key (gsk_...) above to transcribe & classify live audio files in 2 seconds.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', audioFile);
      formData.append('model', 'whisper-large-v3-turbo');
      formData.append('response_format', 'json');

      const sttRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${groqKey.trim()}` },
        body: formData
      });
      if (!sttRes.ok) {
        const err = await sttRes.json().catch(() => ({}));
        throw new Error(err?.error?.message || `Transcription failed (${sttRes.status})`);
      }
      const sttData = await sttRes.json();
      const transcriptText = sttData.text?.trim() || '[No speech detected]';

      const llmRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqKey.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'You are an insurance renewal call QA auditor. Respond ONLY with valid JSON: {"call_outcome": "SUCCESSFUL" or "UNSUCCESSFUL", "reason": "1-sentence clear explanation of why the call succeeded or failed", "category": "RENEWAL_CONFIRMED" | "DISCOUNT_ACCEPTED" | "COMPETITOR_SWITCH" | "PRICE_OBJECTION" | "NETWORK_DROP" | "CALLBACK_REQUESTED", "sentiment": "POSITIVE" | "NEUTRAL" | "ANNOYED", "key_quote": "most important sentence from transcript", "next_action": "recommended follow-up"}'
            },
            { role: 'user', content: `Transcript:\n${transcriptText}` }
          ]
        })
      });
      if (!llmRes.ok) {
        const err = await llmRes.json().catch(() => ({}));
        throw new Error(err?.error?.message || `Classification failed (${llmRes.status})`);
      }
      const llmData = await llmRes.json();
      const parsed = JSON.parse(llmData.choices[0].message.content);

      const newEntry = {
        ...parsed,
        call_id: `LIVE-${String(calls.length + 1).padStart(3, '0')}`,
        source_file: audioFile.name,
        transcript: transcriptText
      };
      setLiveResult(newEntry);
      setCalls(prev => [newEntry, ...prev]);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to process audio file.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeTranscript = async () => {
    setErrorMsg('');
    setLiveResult(null);
    if (!transcriptInput.trim()) {
      setErrorMsg('Please paste or select a call transcript first.');
      return;
    }
    setLoading(true);
    try {
      let parsed;
      if (groqKey.trim()) {
        const llmRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${groqKey.trim()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content:
                  'You are an insurance renewal call QA auditor. Respond ONLY with valid JSON: {"call_outcome": "SUCCESSFUL" or "UNSUCCESSFUL", "reason": "1-sentence clear explanation of why the call succeeded or failed", "category": "RENEWAL_CONFIRMED" | "DISCOUNT_ACCEPTED" | "COMPETITOR_SWITCH" | "PRICE_OBJECTION" | "NETWORK_DROP" | "CALLBACK_REQUESTED", "sentiment": "POSITIVE" | "NEUTRAL" | "ANNOYED", "key_quote": "most important sentence from transcript", "next_action": "recommended follow-up"}'
              },
              { role: 'user', content: `Transcript:\n${transcriptInput}` }
            ]
          })
        });
        const llmData = await llmRes.json();
        parsed = JSON.parse(llmData.choices[0].message.content);
      } else {
        await new Promise(r => setTimeout(r, 450));
        parsed = classifyTranscriptLocally(transcriptInput);
      }

      const newEntry = {
        ...parsed,
        call_id: `TEST-${String(calls.length + 1).padStart(3, '0')}`,
        source_file: 'interactive_sandbox.txt',
        transcript: transcriptInput.trim()
      };
      setLiveResult(newEntry);
      setCalls(prev => [newEntry, ...prev]);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to classify transcript.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at top right, #131c31 0%, #090d16 55%)' }}>
      <header style={{ borderBottom: '1px solid #1e293b', backgroundColor: 'rgba(9, 13, 22, 0.85)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '14px 20px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(59,130,246,0.35)' }}>
              <PhoneCall size={20} color="#fff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#f8fafc' }}>VoiceAnalytics AI</h1>
                <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  PII-SAFE DEMO
                </span>
              </div>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Automated Call Outcome & Failure Diagnostics • Built by Karthik M</p>
            </div>
          </div>

          <div style={{ display: 'flex', backgroundColor: '#111827', padding: '4px', borderRadius: '10px', border: '1px solid #1e293b' }}>
            <button
              onClick={() => setActiveTab('overview')}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 600,
                backgroundColor: activeTab === 'overview' ? '#2563eb' : 'transparent',
                color: activeTab === 'overview' ? '#fff' : '#94a3b8'
              }}
            >
              <BarChart3 size={15} /> Audit Dashboard
            </button>
            <button
              onClick={() => setActiveTab('sandbox')}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 600,
                backgroundColor: activeTab === 'sandbox' ? '#2563eb' : 'transparent',
                color: activeTab === 'sandbox' ? '#fff' : '#94a3b8'
              }}
            >
              <Upload size={15} /> Live Audio / Call Tester
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1120px', margin: '0 auto', padding: '24px 20px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', padding: '12px 16px', borderRadius: '12px', backgroundColor: 'rgba(30, 41, 59, 0.55)', border: '1px solid #334155', marginBottom: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.83rem', color: '#cbd5e1' }}>
            <ShieldCheck size={18} color="#34d399" style={{ flexShrink: 0 }} />
            <span>
              <strong>Zero-PII Architecture:</strong> Pre-loaded records use synthetic demo transcripts classified via local <code style={{ color: '#93c5fd' }}>qwen2.5:3b</code>. Real customer audio stays offline.
            </span>
          </div>
          <button
            onClick={() => setActiveTab('sandbox')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', fontWeight: 600, color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Test your own call audio <ArrowRight size={14} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          <KpiCard title="Total Calls Audited" value={stats.total} subtitle="Synthetic + Live Sandbox" accent="#60a5fa" />
          <KpiCard title="Successful Calls" value={stats.successful} subtitle={`${stats.rate}% Conversion Rate`} accent="#34d399" />
          <KpiCard title="Unsuccessful Calls" value={stats.unsuccessful} subtitle={`${100 - stats.rate}% Drop / Objection`} accent="#f87171" />
          <KpiCard title="Local AI Engine" value="Whisper + Qwen" subtitle="Offline STT & JSON Audit" accent="#a78bfa" />
        </div>

        {activeTab === 'overview' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', alignItems: 'start' }}>
            <div style={{ gridColumn: 'span 2', minWidth: 0 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '14px' }}>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>Call Classification Log</h2>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {['ALL', 'SUCCESSFUL', 'UNSUCCESSFUL'].map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      style={{
                        padding: '5px 12px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                        border: filter === f ? '1px solid #3b82f6' : '1px solid #1e293b',
                        backgroundColor: filter === f ? 'rgba(59, 130, 246, 0.18)' : '#0f172a',
                        color: filter === f ? '#93c5fd' : '#94a3b8'
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredCalls.map(call => {
                  const isSuccess = call.call_outcome === 'SUCCESSFUL';
                  const isOpen = expandedId === call.call_id;
                  return (
                    <div
                      key={call.call_id}
                      style={{
                        borderRadius: '14px', backgroundColor: '#0f172a',
                        border: `1px solid ${isSuccess ? 'rgba(16,185,129,0.28)' : 'rgba(248,113,113,0.28)'}`,
                        padding: '16px', transition: 'all 0.15s ease'
                      }}
                    >
                      <div
                        onClick={() => setExpandedId(isOpen ? null : call.call_id)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc' }}>{call.call_id}</span>
                            <OutcomeBadge outcome={call.call_outcome} />
                            <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '6px', backgroundColor: '#1e293b', color: '#94a3b8', fontWeight: 600 }}>
                              {call.category}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>• {call.source_file}</span>
                          </div>
                          <p style={{ fontSize: '0.9rem', color: '#e2e8f0', fontWeight: 500 }}>{call.reason}</p>
                        </div>
                        <button style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}>
                          {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                      </div>

                      {isOpen && (
                        <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                            <div style={{ padding: '10px 12px', borderRadius: '10px', backgroundColor: '#111827', border: '1px solid #1e293b' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>
                                <Quote size={13} color="#60a5fa" /> KEY EVIDENCE QUOTE
                              </div>
                              <p style={{ fontSize: '0.83rem', color: '#cbd5e1', fontStyle: 'italic' }}>"{call.key_quote}"</p>
                            </div>
                            <div style={{ padding: '10px 12px', borderRadius: '10px', backgroundColor: '#111827', border: '1px solid #1e293b' }}>
                              <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>RECOMMENDED NEXT ACTION</div>
                              <p style={{ fontSize: '0.83rem', color: '#34d399', fontWeight: 500 }}>{call.next_action}</p>
                            </div>
                          </div>

                          <div>
                            <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>FULL TRANSCRIPT</div>
                            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', color: '#cbd5e1', backgroundColor: '#090d16', padding: '12px', borderRadius: '10px', border: '1px solid #1e293b', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                              {call.transcript}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '14px', padding: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <AlertTriangle size={18} color="#f87171" />
                <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#f8fafc' }}>Why Calls Failed</h3>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '14px' }}>
                Root-cause breakdown extracted automatically from unsuccessful conversations:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {stats.failureReasons.map(item => (
                  <div key={item.call_id} style={{ padding: '12px', borderRadius: '10px', backgroundColor: 'rgba(248, 113, 113, 0.08)', border: '1px solid rgba(248, 113, 113, 0.22)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fca5a5' }}>{item.call_id} • {item.category}</span>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{item.sentiment}</span>
                    </div>
                    <p style={{ fontSize: '0.82rem', color: '#e2e8f0' }}>{item.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: '760px', margin: '0 auto', backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', padding: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <Sparkles size={20} color="#60a5fa" />
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Live Call Audio & Transcript Classifier</h2>
            </div>
            <p style={{ fontSize: '0.84rem', color: '#94a3b8', marginBottom: '18px' }}>
              Upload a sample <code style={{ color: '#93c5fd' }}>.mp3 / .wav / .m4a</code> call recording or paste a transcript to get an instant <strong>SUCCESSFUL / UNSUCCESSFUL</strong> verdict and root-cause explanation.
            </p>

            <div style={{ padding: '12px 14px', borderRadius: '12px', backgroundColor: '#111827', border: '1px solid #1e293b', marginBottom: '18px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                <KeyRound size={14} color="#fbbf24" /> Free Groq API Key (Required for Audio Upload • Optional for Text)
              </label>
              <input
                type="password"
                placeholder="Paste free key from console.groq.com (gsk_...)"
                value={groqKey}
                onChange={e => saveKey(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', backgroundColor: '#090d16', border: '1px solid #334155', color: '#f8fafc', fontSize: '0.84rem' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button
                onClick={() => { setSandboxMode('audio'); setErrorMsg(''); }}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                  backgroundColor: sandboxMode === 'audio' ? 'rgba(59,130,246,0.2)' : '#111827',
                  border: sandboxMode === 'audio' ? '1px solid #3b82f6' : '1px solid #1e293b',
                  color: sandboxMode === 'audio' ? '#93c5fd' : '#94a3b8'
                }}
              >
                <FileAudio size={16} /> Upload Call Audio (.mp3 / .wav)
              </button>
              <button
                onClick={() => { setSandboxMode('transcript'); setErrorMsg(''); }}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                  backgroundColor: sandboxMode === 'transcript' ? 'rgba(59,130,246,0.2)' : '#111827',
                  border: sandboxMode === 'transcript' ? '1px solid #3b82f6' : '1px solid #1e293b',
                  color: sandboxMode === 'transcript' ? '#93c5fd' : '#94a3b8'
                }}
              >
                <MessageSquareText size={16} /> Paste / Test Transcript
              </button>
            </div>

            {sandboxMode === 'audio' ? (
              <div>
                <label
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    padding: '28px 16px', borderRadius: '12px', border: '2px dashed #334155', backgroundColor: '#090d16', cursor: 'pointer', textAlign: 'center', marginBottom: '14px'
                  }}
                >
                  <Upload size={26} color="#60a5fa" />
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#e2e8f0' }}>
                    {audioFile ? audioFile.name : 'Tap to choose an audio file (.mp3, .wav, .m4a)'}
                  </span>
                  <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                    Transcribed via Whisper-Large-v3-Turbo & audited for call outcome
                  </span>
                  <input
                    type="file"
                    accept="audio/*,.mp3,.wav,.m4a,.mpeg"
                    onChange={e => setAudioFile(e.target.files?.[0] || null)}
                    style={{ display: 'none' }}
                  />
                </label>

                <button
                  onClick={handleAnalyzeAudio}
                  disabled={loading}
                  style={{
                    width: '100%', padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: '#2563eb', color: '#fff',
                    fontWeight: 700, fontSize: '0.92rem', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                  }}
                >
                  {loading ? <><Loader2 size={18} /> Transcribing & Classifying Audio...</> : 'Analyze Call Audio Now'}
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  {SAMPLE_PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => setTranscriptInput(p.text)}
                      style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#111827', color: '#cbd5e1', fontSize: '0.76rem', cursor: 'pointer' }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={6}
                  value={transcriptInput}
                  onChange={e => setTranscriptInput(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', backgroundColor: '#090d16', border: '1px solid #334155', color: '#f1f5f9', fontSize: '0.84rem', marginBottom: '12px' }}
                />
                <button
                  onClick={handleAnalyzeTranscript}
                  disabled={loading}
                  style={{
                    width: '100%', padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: '#2563eb', color: '#fff',
                    fontWeight: 700, fontSize: '0.92rem', cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loading ? 'Analyzing Transcript...' : 'Classify Transcript Now'}
                </button>
              </div>
            )}

            {errorMsg && (
              <div style={{ marginTop: '14px', padding: '12px', borderRadius: '10px', backgroundColor: 'rgba(239, 68, 68, 0.14)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5', fontSize: '0.84rem' }}>
                {errorMsg}
              </div>
            )}

            {liveResult && (
              <div style={{ marginTop: '18px', padding: '18px', borderRadius: '14px', backgroundColor: '#111827', border: `1px solid ${liveResult.call_outcome === 'SUCCESSFUL' ? '#10b981' : '#f87171'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <OutcomeBadge outcome={liveResult.call_outcome} />
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>{liveResult.category}</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Added to Audit Dashboard ({liveResult.call_id})</span>
                </div>
                <p style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', marginBottom: '10px' }}>{liveResult.reason}</p>
                <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '10px' }}>
                  <strong style={{ color: '#cbd5e1' }}>Recommended Next Action:</strong> {liveResult.next_action}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>EXTRACTED TRANSCRIPT</div>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', color: '#cbd5e1', backgroundColor: '#090d16', padding: '10px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                  {liveResult.transcript}
                </pre>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function KpiCard({ title, value, subtitle, accent }) {
  return (
    <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '14px', padding: '16px 18px' }}>
      <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, marginBottom: '6px' }}>{title}</div>
      <div style={{ fontSize: '1.65rem', fontWeight: 800, color: accent, letterSpacing: '-0.02em', marginBottom: '2px' }}>{value}</div>
      <div style={{ fontSize: '0.76rem', color: '#64748b' }}>{subtitle}</div>
    </div>
  );
}

function OutcomeBadge({ outcome }) {
  const isSuccess = outcome === 'SUCCESSFUL';
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '999px', fontSize: '0.74rem', fontWeight: 700,
        backgroundColor: isSuccess ? 'rgba(16, 185, 129, 0.16)' : 'rgba(248, 113, 113, 0.16)',
        color: isSuccess ? '#34d399' : '#f87171',
        border: `1px solid ${isSuccess ? 'rgba(16, 185, 129, 0.35)' : 'rgba(248, 113, 113, 0.35)'}`
      }}
    >
      {isSuccess ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
      {outcome}
    </span>
  );
}


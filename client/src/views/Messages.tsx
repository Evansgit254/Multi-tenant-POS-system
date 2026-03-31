import React, { useState, useRef, useEffect } from 'react';
import { Send, Search, Phone, Video, MoreVertical, Smile } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api';

interface Message {
  id: string;
  sender: string;
  senderInitials: string;
  senderColor: string;
  text: string;
  time: string;
  isMe: boolean;
}

interface Channel {
  id: string;
  name: string;
  type: 'team' | 'personal';
  lastMessage: string;
  time: string;
  unread: number;
  initials: string;
  color: string;
}

const CHANNELS: Channel[] = [
  { id: 'foh', name: 'Front of House', type: 'team', lastMessage: "Table 12 is asking for the bill.", time: '2m ago', unread: 2, initials: 'FH', color: '#3b82f6' },
  { id: 'kitchen', name: 'Kitchen', type: 'team', lastMessage: "Two medium steaks for Table 7.", time: 'Just now', unread: 1, initials: 'KT', color: '#f97316' },
  { id: 'maria', name: 'Maria Gomez', type: 'personal', lastMessage: "Can you approve the void on Order #284?", time: '12m ago', unread: 0, initials: 'MG', color: '#8b5cf6' },
  { id: 'daniel', name: 'Daniel Okafor', type: 'personal', lastMessage: "I'll handle the large party at 6 PM.", time: '20m ago', unread: 2, initials: 'DO', color: '#10b981' },
];

const Messages: React.FC = () => {
  const { user } = useAuth();
  const [selectedChannel, setSelectedChannel] = useState<Channel>(CHANNELS[0]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [channels, setChannels] = useState<Channel[]>(CHANNELS);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Fetch messages from backend repeatedly
  useEffect(() => {
    let isCancelled = false;
    const fetchMessages = async () => {
      if (!user?.tenantId) return;
      try {
        const res = await api.get(`/tenants/${user.tenantId}/messages/${selectedChannel.id}`);
        if (!isCancelled) {
          const parsed: Message[] = res.data.map((m: any) => ({
            id: m.id,
            sender: m.sender.name,
            senderInitials: m.sender.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
            senderColor: m.sender.id === user?.id ? 'var(--accent)' : '#94a3b8',
            text: m.content,
            time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isMe: m.sender.id === user?.id
          }));
          setMessages(parsed);
        }
      } catch (err) {
        console.error("Failed to load live messages", err);
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 3000); // Poll every 3 seconds
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [selectedChannel.id, user?.tenantId, user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || !user?.tenantId) return;
    const content = inputText.trim();
    setInputText('');
    
    // Optimistic UI update
    const optimisticMsg: Message = {
      id: Date.now().toString(),
      sender: user.name || 'You',
      senderInitials: (user.name || 'ME').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
      senderColor: 'var(--accent)',
      text: content,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMe: true,
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setChannels(prev => prev.map(c => c.id === selectedChannel.id ? { ...c, unread: 0, lastMessage: content, time: 'Just now' } : c));

    try {
      await api.post(`/tenants/${user.tenantId}/messages`, {
        channel: selectedChannel.id,
        content
      });
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSelectChannel = (ch: Channel) => {
    setSelectedChannel(ch);
    setChannels(prev => prev.map(c => c.id === ch.id ? { ...c, unread: 0 } : c));
  };

  const teams = channels.filter(c => c.type === 'team' && c.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const personal = channels.filter(c => c.type === 'personal' && c.name.toLowerCase().includes(searchQuery.toLowerCase()));
  
  const currentMsgs = messages;

  const Avatar = ({ initials, color, size = 36 }: { initials: string; color: string; size?: number }) => (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700, color: 'white', flexShrink: 0
    }}>
      {initials}
    </div>
  );

  const ChannelRow = ({ ch }: { ch: Channel }) => {
    const isActive = selectedChannel.id === ch.id;
    return (
      <div
        onClick={() => handleSelectChannel(ch)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)',
          cursor: 'pointer', marginBottom: '2px',
          background: isActive ? 'var(--accent-soft)' : 'transparent',
          border: `1px solid ${isActive ? 'var(--accent-border)' : 'transparent'}`,
          transition: 'all 0.15s'
        }}
        onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)'; }}
        onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
      >
        <div style={{ position: 'relative' }}>
          <Avatar initials={ch.initials} color={ch.color} size={38} />
          {ch.unread > 0 && (
            <span style={{
              position: 'absolute', top: -3, right: -3,
              width: '1.1rem', height: '1.1rem', borderRadius: '50%',
              background: 'var(--accent)', color: 'white', fontSize: '0.55rem',
              fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid var(--bg-elevated)'
            }}>{ch.unread}</span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
            <span style={{ fontWeight: 600, fontSize: '0.875rem', color: isActive ? 'var(--accent)' : 'var(--text-primary)' }}>{ch.name}</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{ch.time}</span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.lastMessage}</p>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 4rem)', gap: '1rem', overflow: 'hidden' }}>

      {/* ── Channel List ── */}
      <div style={{
        width: '300px', flexShrink: 0, display: 'flex', flexDirection: 'column',
        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)', overflow: 'hidden'
      }}>
        <div style={{ padding: '1.125rem 1.25rem 0.75rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
            <h2 style={{ fontWeight: 700, fontSize: '1.05rem' }}>Messages</h2>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <button style={{ padding: '0.375rem', borderRadius: '7px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <Search size={16} />
              </button>
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              type="text"
              placeholder="Search conversations..."
              className="form-input"
              style={{ paddingLeft: '2.1rem', fontSize: '0.8rem', padding: '0.55rem 0.75rem 0.55rem 2.1rem' }}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
          {teams.length > 0 && (
            <>
              <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', padding: '0.375rem 0.25rem 0.5rem' }}>Teams</p>
              {teams.map(ch => <ChannelRow key={ch.id} ch={ch} />)}
            </>
          )}
          {personal.length > 0 && (
            <>
              <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', padding: '0.75rem 0.25rem 0.5rem' }}>Personal</p>
              {personal.map(ch => <ChannelRow key={ch.id} ch={ch} />)}
            </>
          )}
        </div>
      </div>

      {/* ── Chat Window ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)', overflow: 'hidden'
      }}>
        {/* Chat Header */}
        <div style={{
          padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
          background: 'rgba(255,255,255,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Avatar initials={selectedChannel.initials} color={selectedChannel.color} size={36} />
            <div>
              <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>{selectedChannel.name}</p>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                {selectedChannel.type === 'team' ? 'Team channel' : 'Staff member'}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.375rem' }}>
            {[Phone, Video, MoreVertical].map((Icon, i) => (
              <button key={i} style={{
                padding: '0.5rem', borderRadius: '8px', background: 'none', border: 'none',
                cursor: 'pointer', color: 'var(--text-secondary)', transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLButtonElement).style.color = 'white'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'; }}
              >
                <Icon size={17} />
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {currentMsgs.length === 0 && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', opacity: 0.4, flexDirection: 'column', gap: '0.75rem' }}>
              <Send size={40} />
              <p style={{ fontSize: '0.875rem' }}>No messages yet. Say hello!</p>
            </div>
          )}

          {/* Date label */}
          {currentMsgs.length > 0 && (
            <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.06)', padding: '0.25rem 0.875rem', borderRadius: '99px', border: '1px solid var(--border)' }}>
                Today
              </span>
            </div>
          )}

          {currentMsgs.map(msg => (
            <div key={msg.id} style={{ display: 'flex', gap: '0.625rem', flexDirection: msg.isMe ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
              {!msg.isMe && <Avatar initials={msg.senderInitials} color={msg.senderColor} size={28} />}
              <div style={{ maxWidth: '65%', display: 'flex', flexDirection: 'column', alignItems: msg.isMe ? 'flex-end' : 'flex-start' }}>
                {!msg.isMe && (
                  <p style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem', marginLeft: '0.25rem' }}>
                    {msg.sender}
                  </p>
                )}
                <div style={{
                  padding: '0.6rem 0.875rem',
                  borderRadius: msg.isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: msg.isMe ? 'var(--accent)' : 'rgba(255,255,255,0.07)',
                  border: `1px solid ${msg.isMe ? 'transparent' : 'var(--border)'}`,
                  color: msg.isMe ? 'white' : 'var(--text-primary)',
                  fontSize: '0.875rem',
                  lineHeight: 1.5,
                }}>
                  {msg.text}
                </div>
                <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.2rem', textAlign: msg.isMe ? 'right' : 'left', paddingInline: '0.25rem' }}>
                  {msg.time}
                </p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: '0.875rem 1.25rem', borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: '0.625rem', flexShrink: 0
        }}>
          <button style={{ padding: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
            <Smile size={18} />
          </button>
          <input
            type="text"
            placeholder="Write a message..."
            className="form-input"
            style={{ flex: 1, fontSize: '0.9rem' }}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim()}
            className="btn btn-primary"
            style={{ padding: '0.6rem 1rem', flexShrink: 0, opacity: inputText.trim() ? 1 : 0.4 }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Messages;


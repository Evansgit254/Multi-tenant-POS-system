import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Trash2, Pencil, Save, LayoutGrid, RefreshCw, Layers } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface TableData {
  id: string;
  number: string;
  capacity: number;
  x: number;
  y: number;
  status: 'available' | 'occupied' | 'reserved';
  isActive: boolean;
}

const statusColors: Record<string, { bg: string; border: string; label: string; dot: string; glow: string }> = {
  available: { bg: '#ffffff', border: '#22c55e', label: '#22c55e', dot: '#22c55e', glow: 'rgba(34,197,94,0.15)' },
  occupied:  { bg: '#ffffff', border: '#ef4444', label: '#ef4444', dot: '#ef4444', glow: 'rgba(239,68,68,0.15)' },
  reserved:  { bg: '#ffffff', border: '#fbbf24', label: '#fbbf24', dot: '#fbbf24', glow: 'rgba(251,191,36,0.15)' },
};

const TABLE_W = 100;
const TABLE_H = 100;

const FloorPlan: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);

  const [tables, setTables] = useState<TableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTable, setNewTable] = useState({ number: '', capacity: 2 });
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; tableX: number; tableY: number } | null>(null);

  const fetchTables = useCallback(async () => {
    if (!user?.tenantId) return;
    try {
      const res = await api.get(`/tenants/${user.tenantId}/tables`);
      setTables(res.data);
    } catch (e) {
      showToast('Failed to load tables', 'error');
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId]);

  useEffect(() => {
    fetchTables();
    const interval = setInterval(fetchTables, 15000);
    return () => clearInterval(interval);
  }, [fetchTables]);

  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    if (!editMode) return;
    e.preventDefault();
    const table = tables.find(t => t.id === id);
    if (!table) return;
    setSelected(id);
    setDragging({ id, startX: e.clientX, startY: e.clientY, tableX: table.x, tableY: table.y });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging || !canvasRef.current) return;
    const dx = e.clientX - dragging.startX;
    const dy = e.clientY - dragging.startY;
    const rect = canvasRef.current.getBoundingClientRect();
    
    // Bounds check within flexible container
    const maxX = rect.width - TABLE_W;
    const maxY = rect.height - TABLE_H;
    
    const newX = Math.max(0, Math.min(maxX, dragging.tableX + dx));
    const newY = Math.max(0, Math.min(maxY, dragging.tableY + dy));
    
    setTables(prev => prev.map(t => t.id === dragging.id ? { ...t, x: newX, y: newY } : t));
  }, [dragging]);

  const handleMouseUp = useCallback(async () => {
    if (!dragging) return;
    const table = tables.find(t => t.id === dragging.id);
    if (table) {
      try {
        await api.patch(`/tenants/${user?.tenantId}/tables/${dragging.id}/coordinates`, { x: table.x, y: table.y });
      } catch { /* non-critical */ }
    }
    setDragging(null);
  }, [dragging, tables, user?.tenantId]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const handleAddTable = async () => {
    if (!newTable.number.trim()) {
      showToast('Table number or name is required', 'error');
      return;
    }
    const safeX = Math.floor(Math.random() * 300) + 100;
    const safeY = Math.floor(Math.random() * 200) + 100;
    try {
      const res = await api.post(`/tenants/${user?.tenantId}/tables`, {
        number: newTable.number,
        capacity: newTable.capacity,
        x: safeX,
        y: safeY,
      });
      setTables(prev => [...prev, res.data]);
      setShowAddModal(false);
      setNewTable({ number: '', capacity: 2 });
      showToast(`Table ${newTable.number} added`, 'success');
    } catch {
      showToast('Failed to add table', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this table?')) return;
    try {
      await api.delete(`/tenants/${user?.tenantId}/tables/${id}`);
      setTables(prev => prev.filter(t => t.id !== id));
      if (selected === id) setSelected(null);
      showToast('Table deleted', 'success');
    } catch {
      showToast('Failed to delete table', 'error');
    }
  };

  const summary = { available: 0, occupied: 0, reserved: 0 };
  tables.forEach(t => { if (t.isActive) summary[t.status]++; });

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-secondary)' }}>
      <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', marginRight: 12, color: 'var(--accent)' }} />
      <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>Loading Workspace...</span>
    </div>
  );

  return (
    <div style={{ padding: '0', height: 'calc(100vh - 2rem)', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      
      {/* Title & Canvas Container merged for seamless edge-to-edge feel */}
      <div 
        ref={canvasRef}
        style={{
          flex: 1,
          position: 'relative',
          background: 'var(--bg-elevated)',
          backgroundImage: `
            linear-gradient(to right, rgba(0,0,0,0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0,0,0,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          boxShadow: 'inset 0 0 60px rgba(0,0,0,0.02)',
          overflow: 'hidden',
          borderRadius: '1.5rem',
          margin: '1rem',
          border: '1px solid var(--border)',
          cursor: editMode ? 'crosshair' : 'default',
        }}
        onClick={() => setSelected(null)}
      >
        
        {/* Floating Header Inside Canvas */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '1.5rem 2rem', pointerEvents: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 10 }}>
          <div style={{ pointerEvents: 'auto' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.625rem', letterSpacing: '-0.02em' }}>
              <Layers size={24} color="var(--accent)" /> Workspace
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem', fontWeight: 500 }}>
              Live interactive restaurant topology
            </p>
          </div>
          
          {/* Floating Glass Status Legend */}
          <div style={{ display: 'flex', gap: '0.75rem', pointerEvents: 'auto' }}>
            {Object.entries(summary).map(([status, count]) => {
              const c = statusColors[status];
              return (
                <div key={status} style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.5)', borderRadius: '99px', padding: '0.4rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 15px rgba(0,0,0,0.04)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot, display: 'inline-block', boxShadow: `0 0 8px ${c.dot}` }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{status}</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', marginLeft: '0.25rem' }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tables */}
        {tables.filter(t => t.isActive).map(table => {
          const c = statusColors[table.status] || statusColors.available;
          const isSelected = selected === table.id;
          return (
            <div
              key={table.id}
              onMouseDown={e => { e.stopPropagation(); handleMouseDown(e, table.id); }}
              onClick={e => { e.stopPropagation(); setSelected(table.id); }}
              style={{
                position: 'absolute',
                left: table.x,
                top: table.y,
                width: TABLE_W,
                height: TABLE_H,
                background: c.bg,
                border: editMode ? '1px dashed #d1d5db' : `1px solid ${c.border}`,
                borderRadius: '50%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: editMode ? 'grab' : 'pointer',
                userSelect: 'none',
                transition: dragging?.id === table.id ? 'none' : 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                boxShadow: isSelected 
                  ? `0 0 0 3px #ffffff, 0 0 0 6px var(--accent), 0 20px 40px rgba(0,0,0,0.15)` 
                  : `0 10px 30px ${c.glow}, 0 4px 12px rgba(0,0,0,0.05)`,
                zIndex: dragging?.id === table.id ? 100 : (isSelected ? 50 : 1),
                transform: dragging?.id === table.id ? 'scale(1.05)' : 'scale(1)',
              }}
            >
              <div style={{ position: 'absolute', top: '-6px', right: '-6px', background: c.bg, borderRadius: '50%', padding: '0.2rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.dot, display: 'block' }} />
              </div>
              
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>T{table.number}</span>
              <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.25rem' }}>{table.capacity} PAX</span>

              {/* Delete button in edit mode + selected */}
              {editMode && isSelected && (
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(table.id); }}
                  style={{
                    position: 'absolute',
                    bottom: -10,
                    width: 28, height: 28,
                    background: '#ef4444',
                    border: '2px solid white',
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: 'var(--text-inverted)',
                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
                    transition: 'transform 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          );
        })}

        {/* Empty State */}
        {tables.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', color: 'var(--text-muted)', pointerEvents: 'none' }}>
            <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'var(--input-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LayoutGrid size={40} style={{ opacity: 0.5 }} />
            </div>
            <p style={{ fontSize: '1rem', fontWeight: 500, letterSpacing: '-0.01em' }}>Empty blueprint. Enter edit mode to add tables.</p>
          </div>
        )}

        {/* Floating Control Dock */}
        <div style={{ 
          position: 'absolute', 
          bottom: '2.5rem', 
          left: '50%', 
          transform: 'translateX(-50%)',
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(16px)',
          border: '1px solid var(--border)',
          borderRadius: '99px',
          padding: '0.5rem',
          display: 'flex',
          gap: '0.5rem',
          boxShadow: '0 20px 50px -10px rgba(0,0,0,0.1), 0 0 0 1px rgba(255,255,255,0.5) inset',
          zIndex: 200,
          pointerEvents: 'auto'
        }}>
          <button
            onClick={(e) => { e.stopPropagation(); setEditMode(!editMode); setSelected(null); }}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '0.5rem', 
              padding: '0.625rem 1.25rem', 
              borderRadius: '99px',
              border: 'none',
              background: editMode ? 'var(--bg-inverted)' : 'transparent',
              color: editMode ? 'var(--text-inverted)' : 'var(--text-secondary)',
              fontSize: '0.85rem', fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Pencil size={16} />
            {editMode ? 'Done Editing' : 'Edit Layout'}
          </button>
          
          <button
            onClick={(e) => { e.stopPropagation(); setShowAddModal(true); }}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '0.5rem', 
              padding: '0.625rem 1.25rem', 
              borderRadius: '99px',
              border: 'none',
              background: 'var(--accent)',
              color: 'var(--text-inverted)',
              fontSize: '0.85rem', fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 15px var(--accent-glow)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <Plus size={16} />
            Add Table
          </button>
        </div>
        
        {/* Edit Mode Overlay Indicator */}
        {editMode && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            boxShadow: 'inset 0 0 0 4px var(--accent)',
            pointerEvents: 'none',
            borderRadius: '1.5rem',
            zIndex: 15
          }} />
        )}

      </div>

      {/* Add Table Modal (Glassmorphic) */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.5)', borderRadius: '1.25rem', padding: '2rem', width: '24rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1.5rem', letterSpacing: '-0.02em' }}>Configure Table</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>Identifier</label>
                <input type="text" className="form-input" style={{ fontSize: '1rem', padding: '0.75rem 1rem' }} placeholder="e.g. 1" value={newTable.number} onChange={e => setNewTable(n => ({ ...n, number: e.target.value }))} autoFocus />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>Capacity (PAX)</label>
                <input type="number" className="form-input" style={{ fontSize: '1rem', padding: '0.75rem 1rem' }} min={1} max={20} value={newTable.capacity} onChange={e => setNewTable(n => ({ ...n, capacity: Number(e.target.value) }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '2rem' }}>
              <button onClick={() => setShowAddModal(false)} style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem', border: '1px solid var(--border)', background: 'transparent', fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleAddTable} style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem', border: 'none', background: 'var(--bg-inverted)', color: 'var(--text-inverted)', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <Save size={16} /> Deploy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FloorPlan;

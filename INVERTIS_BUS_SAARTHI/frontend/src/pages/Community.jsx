import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Image as ImageIcon, Video, Mic, X, ThumbsUp, ShieldAlert, CheckCircle2, UserCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { BACKEND_URL } from '../config';
import '../index.css';

const Community = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [newComplaintText, setNewComplaintText] = useState('');
  const [complaints, setComplaints] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const isAdmin = user?.role === 'admin';

  // Fetch complaints from backend
  useEffect(() => {
    const fetchComplaints = async () => {
      try {
        const response = await axios.get(`${BACKEND_URL}/api/grievances`);
        if (response.data.status === 'success') {
          // If empty, put some mock data for demo purposes, else use real data
          const fetchedComplaints = response.data.data || [];
          setComplaints(fetchedComplaints.length > 0 ? fetchedComplaints : [
            {
              _id: 'mock1',
              realName: 'Gaurav Kumar',
              text: 'AC is not working properly in UP 25 AB 1234 since last two days.',
              type: 'text',
              upvotes: 14,
              status: 'pending',
              time: '2 hours ago',
              route: 'Route 4'
            }
          ]);
        }
      } catch (error) {
        console.error("Failed to load grievances", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchComplaints();
  }, []);

  const handlePostComplaint = async (e) => {
    e.preventDefault();
    if (!newComplaintText.trim()) return;

    try {
      const payload = {
        realName: user?.name || 'Student User',
        login_id: user?.id || 'Unknown',
        text: newComplaintText,
        type: 'text', // Assuming text for now, could be media based on attached files
        route: user?.route_id || 'Route 4',
        time: 'Just now'
      };

      const response = await axios.post(`${BACKEND_URL}/api/grievance`, payload);

      if (response.data.status === 'success') {
        // Add locally to feed immediately
        const newComp = { ...payload, _id: response.data.id, upvotes: 0, status: 'pending' };
        setComplaints([newComp, ...complaints]);
        setShowModal(false);
        setNewComplaintText('');
        toast.success("Complaint raised anonymously!");
      }
    } catch (error) {
      toast.error("Failed to submit. Please try again.");
    }
  };

  const handleUpvote = async (id) => {
    try {
      await axios.put(`${BACKEND_URL}/api/grievance/${id}/upvote`);
      setComplaints(complaints.map(c =>
        c._id === id ? { ...c, upvotes: (c.upvotes || 0) + 1 } : c
      ));
    } catch (err) {
      console.error("Failed to upvote", err);
    }
  };

  const handleResolve = async (id) => {
    if (!isAdmin) return;
    try {
      await axios.put(`${BACKEND_URL}/api/grievance/${id}/resolve`);
      setComplaints(complaints.map(c =>
        c._id === id ? { ...c, status: 'resolved' } : c
      ));
    } catch (err) {
      toast.error("Failed to resolve complaint.");
    }
  };

  return (
    <div className="h-screen flex flex-col relative" style={{ backgroundColor: 'var(--bg-color)' }}>
      {/* Header */}
      <header className="p-header" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: 'var(--primary-blue)', color: 'white',
        boxShadow: 'var(--shadow)', zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0 }}>Grievance Portal</h1>
            <p style={{ fontSize: '0.75rem', margin: 0, opacity: 0.8 }}>Anonymous Student Feed</p>
          </div>
        </div>
      </header>

      {/* Feed Area */}
      <main className="p-main" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '6rem' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--text-light)' }}>Loading grievances...</div>
        ) : complaints.map((comp) => (
          <div key={comp._id} className="glass animate-slide-up p-glass" style={{
            borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '1rem'
          }}>
            {/* Header of Post */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ backgroundColor: '#e9ecef', padding: '0.5rem', borderRadius: '50%' }}>
                  <UserCircle2 size={24} color="var(--text-light)" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-dark)' }}>
                    {isAdmin ? <span style={{ color: 'var(--primary-blue)' }}>{comp.realName} (Real Name)</span> : 'Anonymous Student'}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-light)' }}>
                    {comp.route} • {comp.time}
                  </p>
                </div>
              </div>

              <span style={{
                fontSize: '0.7rem', fontWeight: 'bold', padding: '0.25rem 0.5rem', borderRadius: '8px',
                backgroundColor: comp.status === 'resolved' ? '#e6fae6' : '#fff1f0',
                color: comp.status === 'resolved' ? '#28a745' : '#cf1322',
                display: 'flex', alignItems: 'center', gap: '0.25rem'
              }}>
                {comp.status === 'resolved' ? <CheckCircle2 size={12} /> : <ShieldAlert size={12} />}
                {comp.status.toUpperCase()}
              </span>
            </div>

            {/* Content */}
            <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-dark)', lineHeight: 1.5 }}>
              {comp.text}
            </p>

            {/* Media Attachment Mockup (Insta Style) */}
            {comp.type === 'photo' && (
              <div style={{ borderRadius: '12px', overflow: 'hidden', marginTop: '0.5rem', border: '1px solid var(--border-color)' }}>
                <img src="https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=800" alt="Complaint Attachment" style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '250px', objectFit: 'cover' }} />
              </div>
            )}

            {comp.type === 'video' && (
              <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', marginTop: '0.5rem', border: '1px solid var(--border-color)', backgroundColor: 'black', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <img src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&q=80&w=800" alt="Video Thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6, position: 'absolute' }} />
                <div style={{ zIndex: 1, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: '50%', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                  <div style={{ width: 0, height: 0, borderTop: '10px solid transparent', borderBottom: '10px solid transparent', borderLeft: '16px solid white', marginLeft: '5px' }}></div>
                </div>
              </div>
            )}

            {comp.type === 'audio' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: '30px', marginTop: '0.5rem', border: '1px solid var(--border-color)' }}>
                <button style={{ backgroundColor: 'var(--primary-blue)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                  <div style={{ width: 0, height: 0, borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderLeft: '10px solid white', marginLeft: '3px' }}></div>
                </button>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '3px', overflow: 'hidden' }}>
                  {/* Fake Audio Waveform */}
                  {[...Array(25)].map((_, i) => (
                    <div key={i} style={{ width: '4px', height: `${Math.random() * 20 + 8}px`, backgroundColor: i < 8 ? 'var(--primary-blue)' : '#cfd4da', borderRadius: '2px' }}></div>
                  ))}
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: 'bold' }}>0:12</span>
              </div>
            )}

            {/* Upvote & Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f0f0f0', paddingTop: '1rem', marginTop: '0.5rem' }}>
              <button onClick={() => handleUpvote(comp._id)} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none',
                color: 'var(--primary-blue)', fontWeight: '600', cursor: 'pointer', padding: '0.5rem', borderRadius: '8px', transition: 'background-color 0.2s'
              }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e6f0fa'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                <ThumbsUp size={18} /> {comp.upvotes || 0} Agree
              </button>

              {isAdmin && comp.status === 'pending' && (
                <button onClick={() => handleResolve(comp._id)} style={{
                  backgroundColor: 'var(--secondary-orange)', color: 'white', border: 'none',
                  padding: '0.4rem 1rem', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer'
                }}>
                  Mark Resolved
                </button>
              )}
            </div>
          </div>
        ))}
      </main>

      {/* Floating Action Button */}
      {!isAdmin && (
        <button
          onClick={() => setShowModal(true)}
          style={{
            position: 'absolute', bottom: '2rem', right: '2rem', width: '60px', height: '60px',
            borderRadius: '50%', backgroundColor: 'var(--secondary-orange)', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(255, 102, 0, 0.4)', border: 'none', cursor: 'pointer',
            zIndex: 20, transition: 'transform 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <Plus size={32} />
        </button>
      )}

      {/* Raise Complaint Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center'
        }}>
          <div className="animate-slide-up p-glass" style={{
            backgroundColor: 'var(--card-bg)', width: '100%', maxWidth: '600px', borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
            display: 'flex', flexDirection: 'column', gap: '1.5rem',
            boxShadow: '0 -10px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--primary-blue)' }}>Raise a Grievance</h2>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-light)' }}>Your name will be hidden from other students.</p>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: '#f8f9fa', border: 'none', borderRadius: '50%', padding: '0.5rem', cursor: 'pointer' }}>
                <X size={24} color="var(--text-dark)" />
              </button>
            </div>

            <form onSubmit={handlePostComplaint} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <textarea
                value={newComplaintText}
                onChange={(e) => setNewComplaintText(e.target.value)}
                placeholder="What's the issue? (e.g. Bus is overcrowded, Rash driving...)"
                rows={4}
                style={{
                  width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)',
                  fontSize: '1rem', outline: 'none', resize: 'none', fontFamily: 'inherit'
                }}
                required
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button type="button" onClick={() => toast("Photo upload coming soon!")} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--text-dark)' }}>
                    <ImageIcon size={18} color="var(--primary-blue)" /> <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Photo</span>
                  </button>
                  <button type="button" onClick={() => toast("Video upload coming soon!")} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--text-dark)' }}>
                    <Video size={18} color="#cf1322" /> <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Video</span>
                  </button>
                  <button type="button" onClick={() => toast("Voice note coming soon!")} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--text-dark)' }}>
                    <Mic size={18} color="var(--secondary-orange)" /> <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Audio</span>
                  </button>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ padding: '1rem', borderRadius: '12px', fontSize: '1.1rem', marginTop: '0.5rem' }}>
                Post Complaint Anonymously
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Community;

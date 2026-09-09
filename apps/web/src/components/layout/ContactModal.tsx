import { useState } from 'react';
import { Modal } from '@/components/ui';
import { Send, Check, Mail } from 'lucide-react';
import './ContactModal.css';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ContactModal({ isOpen, onClose }: ContactModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const contactEmail = 'communications@gsb.columbia.edu';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Create mailto link with pre-filled content
    const subject = encodeURIComponent(`Gantry Inquiry from ${name}`);
    const body = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
    );

    window.location.href = `mailto:${contactEmail}?subject=${subject}&body=${body}`;

    setSent(true);
    setTimeout(() => {
      setSent(false);
      setName('');
      setEmail('');
      setMessage('');
      onClose();
    }, 2000);
  };

  const handleClose = () => {
    setName('');
    setEmail('');
    setMessage('');
    setSent(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Contact Us" size="md">
      <div className="contact-modal-content">
        <div className="contact-modal-info">
          <Mail size={20} className="contact-modal-icon" />
          <div className="contact-modal-text">
            <h3 className="contact-modal-title">Get in Touch</h3>
            <p className="contact-modal-description">
              Have questions or feedback? Send us a message and we'll get back to you.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="contact-form">
          <div className="contact-form-group">
            <label htmlFor="contact-name" className="contact-label">Name</label>
            <input
              id="contact-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="contact-input"
              required
            />
          </div>

          <div className="contact-form-group">
            <label htmlFor="contact-email" className="contact-label">Email</label>
            <input
              id="contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="contact-input"
              required
            />
          </div>

          <div className="contact-form-group">
            <label htmlFor="contact-message" className="contact-label">Message</label>
            <textarea
              id="contact-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="How can we help you?"
              className="contact-textarea"
              rows={4}
              required
            />
          </div>

          <button
            type="submit"
            className={`contact-submit-btn ${sent ? 'sent' : ''}`}
            disabled={sent}
          >
            {sent ? (
              <>
                <Check size={16} />
                <span>Opening Email Client...</span>
              </>
            ) : (
              <>
                <Send size={16} />
                <span>Send Message</span>
              </>
            )}
          </button>
        </form>

        <div className="contact-modal-footer">
          <p className="contact-modal-note">
            Or email us directly at{' '}
            <a href={`mailto:${contactEmail}`} className="contact-email-link">
              {contactEmail}
            </a>
          </p>
        </div>
      </div>
    </Modal>
  );
}

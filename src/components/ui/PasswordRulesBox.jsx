import React from 'react';
import { PASSWORD_RULES } from '../../utils/passwordPolicy';

const PasswordRulesBox = ({ password = '' }) => {
  const value = String(password || '');
  return (
    <div style={{
      marginTop: '0.5rem', padding: '0.85rem 1rem', borderRadius: '12px',
      border: '1px solid #374151', background: '#111827',
    }}>
      <p style={{ color: '#d1d5db', margin: '0 0 0.5rem', fontSize: '0.82rem', fontWeight: 700 }}>
        Requisitos da senha:
      </p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '4px' }}>
        {PASSWORD_RULES.map((rule, i) => {
          const passed = value.length > 0 && rule.test(value);
          return (
            <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: value.length === 0 ? '#9ca3af' : passed ? '#4ade80' : '#f87171' }}>
              <span style={{ fontSize: '0.7rem' }}>{value.length === 0 ? '○' : passed ? '✓' : '✗'}</span>
              {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default PasswordRulesBox;

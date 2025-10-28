import React from 'react';
import { useFeatureFlags } from '../../api/FeatureFlagsProvider';
import { useI18n } from '../../app/i18n/I18nProvider';

const toggleStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  background: '#f8fafc',
};

const AdminDemoToggle: React.FC = () => {
  const { flags, setFlag } = useFeatureFlags();
  const { t } = useI18n();

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <div>
        <h3 style={{ margin: 0 }}>{t('demo.toggle.title')}</h3>
        <p style={{ margin: 0, color: '#475569', fontSize: 14 }}>{t('demo.toggle.description')}</p>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        <label style={toggleStyle}>
          <span>{t('demo.toggle.utilities')}</span>
          <input
            type="checkbox"
            checked={flags.utilities}
            onChange={event => setFlag('utilities', event.target.checked)}
          />
        </label>
        <label style={toggleStyle}>
          <span>{t('demo.toggle.insurance')}</span>
          <input
            type="checkbox"
            checked={flags.insurance}
            onChange={event => setFlag('insurance', event.target.checked)}
          />
        </label>
      </div>
    </section>
  );
};

export default AdminDemoToggle;

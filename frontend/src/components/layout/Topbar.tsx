import React from 'react';
import { Search, Bell, HelpCircle, Globe2, UserCircle2 } from 'lucide-react';
import { useI18n } from '../../app/i18n/I18nProvider';
import { useFeatureFlags } from '../../api/FeatureFlagsProvider';

interface TopbarProps {
  onSearch?: (value: string) => void;
}

const Topbar: React.FC<TopbarProps> = ({ onSearch }) => {
  const { t, locale, setLocale } = useI18n();
  const { flags } = useFeatureFlags();

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '0 24px',
        height: 64,
        borderBottom: '1px solid #e2e8f0',
        background: '#fff',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
        <Search size={18} aria-hidden />
        <input
          aria-label={t('app.search.placeholder')}
          placeholder={t('app.search.placeholder')}
          onChange={event => onSearch?.(event.target.value)}
          style={{
            border: 'none',
            outline: 'none',
            width: '100%',
            fontSize: 14,
            color: '#0f172a',
          }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 12, color: '#64748b' }}>Demo: {flags.utilities ? 'utilities' : 'no utilities'} / {flags.insurance ? 'insurance' : 'no insurance'}</span>
        <button type="button" title={t('app.notifications')} style={iconButtonStyle}>
          <Bell size={18} aria-hidden />
        </button>
        <button type="button" title={t('app.help')} style={iconButtonStyle}>
          <HelpCircle size={18} aria-hidden />
        </button>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Globe2 size={18} aria-hidden />
          <select
            aria-label={t('app.language')}
            value={locale}
            onChange={event => setLocale(event.target.value as any)}
            style={{ border: 'none', background: 'transparent', fontSize: 14 }}
          >
            <option value="es">ES</option>
            <option value="en">EN</option>
          </select>
        </div>
        <button type="button" title={t('app.profile')} style={iconButtonStyle}>
          <UserCircle2 size={20} aria-hidden />
        </button>
      </div>
    </header>
  );
};

const iconButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: '#0f172a',
  padding: 4,
  cursor: 'pointer',
  borderRadius: 8,
};

export default Topbar;

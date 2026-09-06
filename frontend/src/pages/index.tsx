import { useEffect, useState } from 'react';

type HealthState = 'checking' | 'online' | 'degraded' | 'offline';

export default function HomePage() {
  const [health, setHealth] = useState<HealthState>('checking');

  useEffect(() => {
    let mounted = true;

    fetch('/api/v1/health')
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Health check failed with HTTP ${response.status}`);
        }
        return response.json() as Promise<{ status?: string }>;
      })
      .then((result) => {
        if (!mounted) return;
        setHealth(result.status === 'ok' ? 'online' : 'degraded');
      })
      .catch(() => {
        if (mounted) setHealth('offline');
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#030712',
        color: '#e2e8f0',
        fontFamily: 'system-ui, sans-serif',
        padding: '4rem 1.5rem',
      }}
    >
      <section style={{ maxWidth: 720, margin: '0 auto' }}>
        <p style={{ color: '#22d3ee', fontWeight: 700, letterSpacing: '0.08em' }}>PRO-LIFE</p>
        <h1 style={{ fontSize: '2.5rem', margin: '0.5rem 0 1rem' }}>
          3D Protein Geometry Engine
        </h1>
        <p style={{ color: '#94a3b8', lineHeight: 1.6 }}>
          The frontend is running. The backend status is{' '}
          <strong style={{ color: health === 'online' ? '#34d399' : '#fbbf24' }}>
            {health}
          </strong>
          .
        </p>
        <a
          href="/api/v1/health"
          style={{
            display: 'inline-block',
            marginTop: '1.5rem',
            color: '#67e8f9',
            textDecoration: 'none',
          }}
        >
          Open backend health endpoint
        </a>
      </section>
    </main>
  );
}

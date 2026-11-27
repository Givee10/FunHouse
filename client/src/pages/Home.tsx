import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1115' }}>
      <div style={{ background: '#1a1d24', borderRadius: 20, padding: 32, maxWidth: 420, width: '90%', textAlign: 'center' }}>
        <h1 style={{ margin: '0 0 8px' }}>FunHouse Quiz</h1>
        <p style={{ color: '#8a8f9e', marginBottom: 24 }}>Викторина и таблица результатов</p>
        <Link to="/play" style={{ display: 'block', padding: 14, borderRadius: 12, background: '#4f8cff', color: '#fff', textDecoration: 'none', fontWeight: 700, margin: '8px 0' }}>Играть</Link>
        <Link to="/board" style={{ display: 'block', padding: 14, borderRadius: 12, background: '#2a2f3a', color: '#fff', textDecoration: 'none', fontWeight: 700, margin: '8px 0' }}>Табло</Link>
        <Link to="/admin" style={{ display: 'block', padding: 14, borderRadius: 12, background: '#2a2f3a', color: '#fff', textDecoration: 'none', fontWeight: 700, margin: '8px 0' }}>Админка</Link>
      </div>
    </div>
  );
}
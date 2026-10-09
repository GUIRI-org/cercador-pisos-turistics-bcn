import type { Metadata } from 'next';
import '../styles.css';
import { MapComponent } from '../components/MapComponent';

export const metadata: Metadata = {
  title: 'Mapa | Cercador de pisos turístics Barcelona',
  description: 'Mapa dels habitatges d\'ús turístic de Barcelona per districte i barri.',
};

export default function MapPage() {
  return (
    <main style={{ minHeight: '100vh' }}>
      <section id="seccio-mapa" className='py-0 h-100' style={{minHeight: '100vh'}}>
        <MapComponent />
      </section>
    </main>
  );
}

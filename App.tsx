import React from 'react';
import ChatWidget from './components/ChatWidget';

function App() {
  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden">
      {/* Background content to simulate a website like Framer */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-0">
        
        {/* Hero Section Simulation */}
        <div className="text-center mt-20 mb-16">
          <h1 className="text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
            Bienvenido a <span className="text-indigo-600">Illescas</span>
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Descubre el corazón de la logística en España y un patrimonio cultural único. 
            El Greco, historia y futuro se unen aquí.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <button className="px-6 py-3 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition">
              Visitar
            </button>
            <button className="px-6 py-3 bg-white text-slate-900 border border-slate-200 rounded-lg font-medium hover:bg-slate-50 transition">
              Saber más
            </button>
          </div>
        </div>

        {/* Content Grids */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { title: "El Greco en Illescas", desc: "Admira las obras maestras en el Santuario de la Caridad." },
            { title: "Plataforma Iberum", desc: "El ecopolígono logístico más importante del centro peninsular." },
            { title: "Gastronomía Local", desc: "Disfruta de los sabores tradicionales de La Sagra." }
          ].map((item, idx) => (
             <div key={idx} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition">
               <div className="h-40 bg-slate-200 rounded-lg mb-4 flex items-center justify-center text-slate-400">
                  <img src={`https://picsum.photos/400/300?random=${idx}`} alt={item.title} className="w-full h-full object-cover rounded-lg opacity-80" />
               </div>
               <h3 className="text-lg font-bold text-slate-800 mb-2">{item.title}</h3>
               <p className="text-slate-600 text-sm">{item.desc}</p>
             </div>
          ))}
        </div>

      </main>

      {/* The Assistant Widget */}
      <ChatWidget />
    </div>
  );
}

export default App;
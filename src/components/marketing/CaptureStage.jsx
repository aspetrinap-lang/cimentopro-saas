import React, { Component, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { TAB_COMPONENTS } from './tabRegistry';

// Se uma aba quebrar ao montar (dependência ausente, dados nulos), o print
// mostra o estado real vazio da tela — nunca uma imagem ilustrativa de IA.
class StageBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) {
      return (
        <div style={{ padding: 80, textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
          <h2 style={{ fontSize: 40, fontWeight: 700, color: '#1E293B', margin: 0 }}>{this.props.title}</h2>
          <p style={{ fontSize: 22, color: '#64748B', marginTop: 16 }}>
            CimentoPro — gestão para fábricas de artefatos de concreto.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

// Renderiza a aba real fora da área visível (1280px, estilo desktop) para
// captura via html2canvas. A aba é montada em uma RAIZ React separada
// (createRoot em um container fora do app) para poder ter seu próprio
// MemoryRouter — o react-router proíbe um <Router> dentro de outro.
export default function CaptureStage({ tabKey }) {
  useEffect(() => {
    if (!tabKey) return undefined;
    const entry = TAB_COMPONENTS[tabKey];
    if (!entry) return undefined;

    const host = document.createElement('div');
    host.id = 'capture-stage';
    host.style.cssText =
      'position:fixed;left:-20000px;top:0;width:1280px;min-height:900px;background:#F8FAFC;z-index:-1;overflow:hidden;';
    document.body.appendChild(host);

    const root = createRoot(host);
    const Comp = entry.Component;
    root.render(
      <StageBoundary title={entry.title}>
        <MemoryRouter initialEntries={[entry.path]}>
          <Comp />
        </MemoryRouter>
      </StageBoundary>
    );

    return () => {
      setTimeout(() => {
        try { root.unmount(); } catch { /* já desmontada */ }
        host.remove();
      }, 0);
    };
  }, [tabKey]);

  return null;
}
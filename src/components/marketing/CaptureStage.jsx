import React, { Component } from 'react';
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
// captura via html2canvas. Nada é exibido ao usuário.
export default function CaptureStage({ tabKey }) {
  if (!tabKey) return null;
  const entry = TAB_COMPONENTS[tabKey];
  if (!entry) return null;
  const Comp = entry.Component;
  return (
    <div
      id="capture-stage"
      style={{
        position: 'fixed',
        left: -20000,
        top: 0,
        width: 1280,
        minHeight: 900,
        background: '#F8FAFC',
        zIndex: -1,
        overflow: 'hidden',
      }}
    >
      <StageBoundary title={entry.title}>
        <MemoryRouter initialEntries={[entry.path]}>
          <Comp />
        </MemoryRouter>
      </StageBoundary>
    </div>
  );
}
"use client";
/* ─────────────────────────────────────────────────────────────────────────────
 * SILO OPS — Equipment SVG Icons (24 tipos)
 * Cada ícone é um SVG inline memoizado. viewBox 0 0 32 32.
 * Props: size (default 32), className, color (default currentColor).
 * ────────────────────────────────────────────────────────────────────────── */

import React, { memo } from 'react';
import type { EquipmentIconType } from '@/lib/equipment-icon-types';
import { resolveIconType } from '@/lib/equipment-icon-types';

interface IconSvgProps {
  size?: number;
  className?: string;
  color?: string;
}

type SvgIconFC = React.FC<IconSvgProps>;

const svgBase = (size: number, className?: string) => ({
  xmlns: 'http://www.w3.org/2000/svg' as const,
  viewBox: '0 0 32 32',
  width: size,
  height: size,
  className,
  fill: 'none',
  'aria-hidden': true as const,
});

/* ── 1. TRATOR ───────────────────────────────────────────────────────────── */
const IconTrator: SvgIconFC = memo(({ size = 32, className, color = 'currentColor' }) => (
  <svg {...svgBase(size, className)}>
    <rect x="6" y="12" width="16" height="8" rx="2" fill={color} opacity="0.85"/>
    <rect x="18" y="10" width="8" height="6" rx="1" fill={color} opacity="0.7"/>
    <circle cx="10" cy="23" r="4" stroke={color} strokeWidth="2" fill="none"/>
    <circle cx="24" cy="23" r="3" stroke={color} strokeWidth="2" fill="none"/>
    <rect x="8" y="8" width="4" height="4" rx="1" fill={color} opacity="0.5"/>
  </svg>
));
IconTrator.displayName = 'IconTrator';

/* ── 2. COLHEDORA ────────────────────────────────────────────────────────── */
const IconColhedora: SvgIconFC = memo(({ size = 32, className, color = 'currentColor' }) => (
  <svg {...svgBase(size, className)}>
    <rect x="8" y="10" width="16" height="10" rx="2" fill={color} opacity="0.85"/>
    <rect x="2" y="14" width="8" height="4" rx="1" fill={color} opacity="0.6"/>
    <line x1="3" y1="12" x2="3" y2="20" stroke={color} strokeWidth="1.5" opacity="0.4"/>
    <line x1="5" y1="12" x2="5" y2="20" stroke={color} strokeWidth="1.5" opacity="0.4"/>
    <line x1="7" y1="12" x2="7" y2="20" stroke={color} strokeWidth="1.5" opacity="0.4"/>
    <circle cx="12" cy="24" r="4" stroke={color} strokeWidth="2" fill="none"/>
    <circle cx="24" cy="24" r="3" stroke={color} strokeWidth="2" fill="none"/>
    <rect x="22" y="8" width="4" height="4" rx="1" fill={color} opacity="0.5"/>
  </svg>
));
IconColhedora.displayName = 'IconColhedora';

/* ── 3. TRANSBORDO ───────────────────────────────────────────────────────── */
const IconTransbordo: SvgIconFC = memo(({ size = 32, className, color = 'currentColor' }) => (
  <svg {...svgBase(size, className)}>
    <path d="M4 12h24v6c0 1.1-.9 2-2 2H6a2 2 0 01-2-2v-6z" fill={color} opacity="0.7"/>
    <path d="M6 12l2-4h16l2 4" stroke={color} strokeWidth="1.5" fill="none" opacity="0.5"/>
    <circle cx="10" cy="24" r="3" stroke={color} strokeWidth="2" fill="none"/>
    <circle cx="22" cy="24" r="3" stroke={color} strokeWidth="2" fill="none"/>
  </svg>
));
IconTransbordo.displayName = 'IconTransbordo';

/* ── 4. CAMINHÃO ─────────────────────────────────────────────────────────── */
const IconCaminhao: SvgIconFC = memo(({ size = 32, className, color = 'currentColor' }) => (
  <svg {...svgBase(size, className)}>
    <rect x="2" y="10" width="18" height="10" rx="2" fill={color} opacity="0.8"/>
    <rect x="20" y="14" width="8" height="6" rx="1" fill={color} opacity="0.65"/>
    <rect x="22" y="10" width="6" height="4" rx="1" fill={color} opacity="0.45"/>
    <circle cx="8" cy="24" r="3" stroke={color} strokeWidth="2" fill="none"/>
    <circle cx="24" cy="24" r="3" stroke={color} strokeWidth="2" fill="none"/>
  </svg>
));
IconCaminhao.displayName = 'IconCaminhao';

/* ── 5. CAMINHÃO BASCULANTE ──────────────────────────────────────────────── */
const IconCaminhaoBasculante: SvgIconFC = memo(({ size = 32, className, color = 'currentColor' }) => (
  <svg {...svgBase(size, className)}>
    <path d="M4 10h16l-2 10H4V10z" fill={color} opacity="0.7"/>
    <rect x="20" y="14" width="8" height="6" rx="1" fill={color} opacity="0.65"/>
    <rect x="22" y="10" width="6" height="4" rx="1" fill={color} opacity="0.45"/>
    <circle cx="8" cy="24" r="3" stroke={color} strokeWidth="2" fill="none"/>
    <circle cx="24" cy="24" r="3" stroke={color} strokeWidth="2" fill="none"/>
    <line x1="18" y1="10" x2="16" y2="20" stroke={color} strokeWidth="1" opacity="0.4"/>
  </svg>
));
IconCaminhaoBasculante.displayName = 'IconCaminhaoBasculante';

/* ── 6. CAMINHÃO PIPA ────────────────────────────────────────────────────── */
const IconCaminhaoPipa: SvgIconFC = memo(({ size = 32, className, color = 'currentColor' }) => (
  <svg {...svgBase(size, className)}>
    <ellipse cx="12" cy="15" rx="9" ry="5" fill={color} opacity="0.7"/>
    <rect x="20" y="14" width="8" height="6" rx="1" fill={color} opacity="0.65"/>
    <rect x="22" y="10" width="6" height="4" rx="1" fill={color} opacity="0.45"/>
    <circle cx="8" cy="24" r="3" stroke={color} strokeWidth="2" fill="none"/>
    <circle cx="24" cy="24" r="3" stroke={color} strokeWidth="2" fill="none"/>
  </svg>
));
IconCaminhaoPipa.displayName = 'IconCaminhaoPipa';

/* ── 7. PLANTADEIRA ──────────────────────────────────────────────────────── */
const IconPlantadeira: SvgIconFC = memo(({ size = 32, className, color = 'currentColor' }) => (
  <svg {...svgBase(size, className)}>
    <rect x="4" y="10" width="24" height="6" rx="2" fill={color} opacity="0.75"/>
    <line x1="8" y1="16" x2="8" y2="24" stroke={color} strokeWidth="1.5"/>
    <line x1="13" y1="16" x2="13" y2="24" stroke={color} strokeWidth="1.5"/>
    <line x1="19" y1="16" x2="19" y2="24" stroke={color} strokeWidth="1.5"/>
    <line x1="24" y1="16" x2="24" y2="24" stroke={color} strokeWidth="1.5"/>
    <circle cx="8" cy="25" r="1.5" fill={color}/>
    <circle cx="13" cy="25" r="1.5" fill={color}/>
    <circle cx="19" cy="25" r="1.5" fill={color}/>
    <circle cx="24" cy="25" r="1.5" fill={color}/>
  </svg>
));
IconPlantadeira.displayName = 'IconPlantadeira';

/* ── 8. PULVERIZADOR ─────────────────────────────────────────────────────── */
const IconPulverizador: SvgIconFC = memo(({ size = 32, className, color = 'currentColor' }) => (
  <svg {...svgBase(size, className)}>
    <rect x="10" y="8" width="12" height="10" rx="2" fill={color} opacity="0.8"/>
    <line x1="4" y1="18" x2="28" y2="18" stroke={color} strokeWidth="2" opacity="0.6"/>
    <line x1="6" y1="20" x2="6" y2="26" stroke={color} strokeWidth="1" strokeDasharray="1 2" opacity="0.5"/>
    <line x1="11" y1="20" x2="11" y2="26" stroke={color} strokeWidth="1" strokeDasharray="1 2" opacity="0.5"/>
    <line x1="16" y1="20" x2="16" y2="26" stroke={color} strokeWidth="1" strokeDasharray="1 2" opacity="0.5"/>
    <line x1="21" y1="20" x2="21" y2="26" stroke={color} strokeWidth="1" strokeDasharray="1 2" opacity="0.5"/>
    <line x1="26" y1="20" x2="26" y2="26" stroke={color} strokeWidth="1" strokeDasharray="1 2" opacity="0.5"/>
    <circle cx="14" cy="24" r="3" stroke={color} strokeWidth="1.5" fill="none"/>
    <circle cx="22" cy="24" r="3" stroke={color} strokeWidth="1.5" fill="none"/>
  </svg>
));
IconPulverizador.displayName = 'IconPulverizador';

/* ── 9. PÁ CARREGADEIRA ──────────────────────────────────────────────────── */
const IconPaCarregadeira: SvgIconFC = memo(({ size = 32, className, color = 'currentColor' }) => (
  <svg {...svgBase(size, className)}>
    <rect x="12" y="12" width="12" height="8" rx="2" fill={color} opacity="0.8"/>
    <path d="M4 10h6v8H4l-1-4 1-4z" fill={color} opacity="0.6"/>
    <line x1="10" y1="14" x2="12" y2="14" stroke={color} strokeWidth="2"/>
    <line x1="10" y1="18" x2="12" y2="18" stroke={color} strokeWidth="2"/>
    <circle cx="16" cy="24" r="3" stroke={color} strokeWidth="2" fill="none"/>
    <circle cx="24" cy="24" r="2.5" stroke={color} strokeWidth="2" fill="none"/>
  </svg>
));
IconPaCarregadeira.displayName = 'IconPaCarregadeira';

/* ── 10. MOTONIVELADORA ──────────────────────────────────────────────────── */
const IconMotoniveladora: SvgIconFC = memo(({ size = 32, className, color = 'currentColor' }) => (
  <svg {...svgBase(size, className)}>
    <rect x="10" y="10" width="14" height="8" rx="2" fill={color} opacity="0.8"/>
    <path d="M4 22l6-4H10" stroke={color} strokeWidth="2" fill="none" opacity="0.6"/>
    <line x1="4" y1="22" x2="12" y2="22" stroke={color} strokeWidth="2.5" opacity="0.7"/>
    <circle cx="14" cy="22" r="3" stroke={color} strokeWidth="2" fill="none"/>
    <circle cx="24" cy="22" r="3" stroke={color} strokeWidth="2" fill="none"/>
  </svg>
));
IconMotoniveladora.displayName = 'IconMotoniveladora';

/* ── 11. ESCAVADEIRA ─────────────────────────────────────────────────────── */
const IconEscavadeira: SvgIconFC = memo(({ size = 32, className, color = 'currentColor' }) => (
  <svg {...svgBase(size, className)}>
    <rect x="10" y="14" width="14" height="8" rx="2" fill={color} opacity="0.8"/>
    <rect x="12" y="10" width="8" height="4" rx="1" fill={color} opacity="0.6"/>
    <path d="M8 10L4 4M4 4L2 6" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
    <rect x="10" y="22" width="16" height="3" rx="1" fill={color} opacity="0.5"/>
    <line x1="12" y1="25" x2="12" y2="27" stroke={color} strokeWidth="1.5" opacity="0.4"/>
    <line x1="24" y1="25" x2="24" y2="27" stroke={color} strokeWidth="1.5" opacity="0.4"/>
  </svg>
));
IconEscavadeira.displayName = 'IconEscavadeira';

/* ── 12. TRATOR DE ESTEIRA ───────────────────────────────────────────────── */
const IconTratorEsteira: SvgIconFC = memo(({ size = 32, className, color = 'currentColor' }) => (
  <svg {...svgBase(size, className)}>
    <rect x="6" y="10" width="20" height="8" rx="2" fill={color} opacity="0.8"/>
    <rect x="4" y="18" width="24" height="6" rx="3" stroke={color} strokeWidth="2" fill="none" opacity="0.6"/>
    <circle cx="8" cy="21" r="1.5" fill={color} opacity="0.5"/>
    <circle cx="16" cy="21" r="1.5" fill={color} opacity="0.5"/>
    <circle cx="24" cy="21" r="1.5" fill={color} opacity="0.5"/>
    <rect x="22" y="6" width="4" height="4" rx="1" fill={color} opacity="0.4"/>
  </svg>
));
IconTratorEsteira.displayName = 'IconTratorEsteira';

/* ── 13. COMBOIO ─────────────────────────────────────────────────────────── */
const IconComboio: SvgIconFC = memo(({ size = 32, className, color = 'currentColor' }) => (
  <svg {...svgBase(size, className)}>
    <rect x="4" y="10" width="10" height="10" rx="2" fill={color} opacity="0.75"/>
    <rect x="16" y="10" width="10" height="10" rx="2" fill={color} opacity="0.6"/>
    <line x1="14" y1="15" x2="16" y2="15" stroke={color} strokeWidth="2"/>
    <circle cx="8" cy="24" r="3" stroke={color} strokeWidth="2" fill="none"/>
    <circle cx="22" cy="24" r="3" stroke={color} strokeWidth="2" fill="none"/>
  </svg>
));
IconComboio.displayName = 'IconComboio';

/* ── 14. BOMBA COMBUSTÍVEL ───────────────────────────────────────────────── */
const IconBombaCombustivel: SvgIconFC = memo(({ size = 32, className, color = 'currentColor' }) => (
  <svg {...svgBase(size, className)}>
    <rect x="8" y="10" width="12" height="16" rx="2" fill={color} opacity="0.8"/>
    <rect x="10" y="12" width="8" height="5" rx="1" fill="black" fillOpacity="0.2"/>
    <path d="M22 8l4 4v8" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.6"/>
    <circle cx="26" cy="22" r="2" fill={color} opacity="0.5"/>
    <rect x="12" y="6" width="4" height="4" rx="1" fill={color} opacity="0.5"/>
  </svg>
));
IconBombaCombustivel.displayName = 'IconBombaCombustivel';

/* ── 15. CARRETA / PRANCHA ───────────────────────────────────────────────── */
const IconCarretaPrancha: SvgIconFC = memo(({ size = 32, className, color = 'currentColor' }) => (
  <svg {...svgBase(size, className)}>
    <rect x="2" y="14" width="24" height="4" rx="1" fill={color} opacity="0.7"/>
    <line x1="2" y1="18" x2="2" y2="22" stroke={color} strokeWidth="2"/>
    <circle cx="8" cy="22" r="3" stroke={color} strokeWidth="2" fill="none"/>
    <circle cx="18" cy="22" r="3" stroke={color} strokeWidth="2" fill="none"/>
    <circle cx="24" cy="22" r="3" stroke={color} strokeWidth="2" fill="none"/>
  </svg>
));
IconCarretaPrancha.displayName = 'IconCarretaPrancha';

/* ── 16. GRADE / IMPLEMENTO ──────────────────────────────────────────────── */
const IconGradeImplemento: SvgIconFC = memo(({ size = 32, className, color = 'currentColor' }) => (
  <svg {...svgBase(size, className)}>
    <rect x="4" y="10" width="24" height="4" rx="1" fill={color} opacity="0.7"/>
    <circle cx="8" cy="20" r="3" stroke={color} strokeWidth="2" fill="none"/>
    <circle cx="16" cy="20" r="3" stroke={color} strokeWidth="2" fill="none"/>
    <circle cx="24" cy="20" r="3" stroke={color} strokeWidth="2" fill="none"/>
    <line x1="8" y1="14" x2="8" y2="17" stroke={color} strokeWidth="1.5"/>
    <line x1="16" y1="14" x2="16" y2="17" stroke={color} strokeWidth="1.5"/>
    <line x1="24" y1="14" x2="24" y2="17" stroke={color} strokeWidth="1.5"/>
  </svg>
));
IconGradeImplemento.displayName = 'IconGradeImplemento';

/* ── 17. SILO ────────────────────────────────────────────────────────────── */
const IconSilo: SvgIconFC = memo(({ size = 32, className, color = 'currentColor' }) => (
  <svg {...svgBase(size, className)}>
    <path d="M10 8a6 6 0 0112 0" fill={color} opacity="0.5"/>
    <rect x="10" y="8" width="12" height="16" rx="1" fill={color} opacity="0.8"/>
    <line x1="10" y1="12" x2="22" y2="12" stroke="black" strokeOpacity="0.15" strokeWidth="1"/>
    <line x1="10" y1="16" x2="22" y2="16" stroke="black" strokeOpacity="0.15" strokeWidth="1"/>
    <line x1="10" y1="20" x2="22" y2="20" stroke="black" strokeOpacity="0.15" strokeWidth="1"/>
    <rect x="14" y="22" width="4" height="4" rx="0.5" fill="black" fillOpacity="0.2"/>
  </svg>
));
IconSilo.displayName = 'IconSilo';

/* ── 18. TORRE ───────────────────────────────────────────────────────────── */
const IconTorre: SvgIconFC = memo(({ size = 32, className, color = 'currentColor' }) => (
  <svg {...svgBase(size, className)}>
    <path d="M16 4l-6 22h12L16 4z" fill={color} opacity="0.6"/>
    <line x1="12" y1="12" x2="20" y2="12" stroke={color} strokeWidth="1.5" opacity="0.8"/>
    <line x1="11" y1="18" x2="21" y2="18" stroke={color} strokeWidth="1.5" opacity="0.8"/>
    <circle cx="16" cy="8" r="2" fill={color} opacity="0.9"/>
    <line x1="14" y1="6" x2="12" y2="4" stroke={color} strokeWidth="1.5" opacity="0.5"/>
    <line x1="18" y1="6" x2="20" y2="4" stroke={color} strokeWidth="1.5" opacity="0.5"/>
  </svg>
));
IconTorre.displayName = 'IconTorre';

/* ── 19. LEITOR RFID ─────────────────────────────────────────────────────── */
const IconLeitorRfid: SvgIconFC = memo(({ size = 32, className, color = 'currentColor' }) => (
  <svg {...svgBase(size, className)}>
    <rect x="10" y="10" width="12" height="16" rx="3" fill={color} opacity="0.8"/>
    <circle cx="16" cy="18" r="3" stroke={color} strokeWidth="1.5" fill="none" opacity="0.6"/>
    <path d="M8 12a10 10 0 000 12" stroke={color} strokeWidth="1.5" fill="none" opacity="0.4"/>
    <path d="M5 10a14 14 0 000 16" stroke={color} strokeWidth="1.5" fill="none" opacity="0.25"/>
    <path d="M24 12a10 10 0 010 12" stroke={color} strokeWidth="1.5" fill="none" opacity="0.4"/>
  </svg>
));
IconLeitorRfid.displayName = 'IconLeitorRfid';

/* ── 20. MOBILE ──────────────────────────────────────────────────────────── */
const IconMobile: SvgIconFC = memo(({ size = 32, className, color = 'currentColor' }) => (
  <svg {...svgBase(size, className)}>
    <rect x="10" y="4" width="12" height="24" rx="3" fill={color} opacity="0.8"/>
    <rect x="12" y="8" width="8" height="12" rx="1" fill="black" fillOpacity="0.2"/>
    <circle cx="16" cy="24" r="1.5" fill="black" fillOpacity="0.3"/>
    <line x1="14" y1="6" x2="18" y2="6" stroke="black" strokeOpacity="0.2" strokeWidth="1" strokeLinecap="round"/>
  </svg>
));
IconMobile.displayName = 'IconMobile';

/* ── 21. VEÍCULO ─────────────────────────────────────────────────────────── */
const IconVeiculo: SvgIconFC = memo(({ size = 32, className, color = 'currentColor' }) => (
  <svg {...svgBase(size, className)}>
    <path d="M6 16l2-6h16l2 6" stroke={color} strokeWidth="1.5" fill={color} fillOpacity="0.3"/>
    <rect x="4" y="16" width="24" height="6" rx="2" fill={color} opacity="0.8"/>
    <circle cx="10" cy="24" r="3" stroke={color} strokeWidth="2" fill="none"/>
    <circle cx="22" cy="24" r="3" stroke={color} strokeWidth="2" fill="none"/>
    <rect x="10" y="12" width="4" height="4" rx="0.5" fill="black" fillOpacity="0.15"/>
    <rect x="18" y="12" width="4" height="4" rx="0.5" fill="black" fillOpacity="0.15"/>
  </svg>
));
IconVeiculo.displayName = 'IconVeiculo';

/* ── 22. MOTO ────────────────────────────────────────────────────────────── */
const IconMoto: SvgIconFC = memo(({ size = 32, className, color = 'currentColor' }) => (
  <svg {...svgBase(size, className)}>
    <circle cx="8" cy="22" r="4" stroke={color} strokeWidth="2" fill="none"/>
    <circle cx="24" cy="22" r="4" stroke={color} strokeWidth="2" fill="none"/>
    <path d="M12 22l4-10h4l2 6" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round"/>
    <line x1="16" y1="12" x2="20" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    <line x1="22" y1="18" x2="24" y2="22" stroke={color} strokeWidth="1.5"/>
  </svg>
));
IconMoto.displayName = 'IconMoto';

/* ── 23. PLUVIÔMETRO ─────────────────────────────────────────────────────── */
const IconPluviometro: SvgIconFC = memo(({ size = 32, className, color = 'currentColor' }) => (
  <svg {...svgBase(size, className)}>
    <path d="M10 8l-2 12h16l-2-12H10z" fill={color} opacity="0.7"/>
    <rect x="10" y="20" width="12" height="4" rx="1" fill={color} opacity="0.5"/>
    <line x1="14" y1="4" x2="14" y2="8" stroke={color} strokeWidth="1.5" opacity="0.5"/>
    <circle cx="14" cy="3" r="1.5" fill={color} opacity="0.4"/>
    <line x1="12" y1="12" x2="12" y2="18" stroke="black" strokeOpacity="0.2" strokeWidth="1"/>
    <line x1="16" y1="14" x2="16" y2="18" stroke="black" strokeOpacity="0.2" strokeWidth="1"/>
    <line x1="20" y1="13" x2="20" y2="18" stroke="black" strokeOpacity="0.2" strokeWidth="1"/>
  </svg>
));
IconPluviometro.displayName = 'IconPluviometro';

/* ── 24. PADRÃO GENÉRICO ─────────────────────────────────────────────────── */
const IconPadraoGenerico: SvgIconFC = memo(({ size = 32, className, color = 'currentColor' }) => (
  <svg {...svgBase(size, className)}>
    <circle cx="16" cy="14" r="8" stroke={color} strokeWidth="2" fill={color} fillOpacity="0.15"/>
    <path d="M16 10v4l3 2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <rect x="14" y="24" width="4" height="4" rx="1" fill={color} opacity="0.6"/>
    <line x1="16" y1="22" x2="16" y2="24" stroke={color} strokeWidth="2"/>
  </svg>
));
IconPadraoGenerico.displayName = 'IconPadraoGenerico';

/* ── 25. SULCADOR ────────────────────────────────────────────────────────── */
const IconSulcador: SvgIconFC = memo(({ size = 32, className, color = 'currentColor' }) => (
  <svg {...svgBase(size, className)}>
    {/* Barra transversal do sulcador */}
    <rect x="3" y="11" width="26" height="4" rx="1.5" fill={color} opacity="0.75"/>
    {/* Sulcos: hastes verticais */}
    <line x1="7"  y1="15" x2="7"  y2="24" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="11" y1="15" x2="11" y2="24" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="16" y1="15" x2="16" y2="24" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="21" y1="15" x2="21" y2="24" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="25" y1="15" x2="25" y2="24" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    {/* Pontas dos sulcos */}
    <path d="M5 24l2 4 2-4" fill={color} opacity="0.6"/>
    <path d="M9 24l2 4 2-4"  fill={color} opacity="0.6"/>
    <path d="M14 24l2 4 2-4" fill={color} opacity="0.6"/>
    <path d="M19 24l2 4 2-4" fill={color} opacity="0.6"/>
    <path d="M23 24l2 4 2-4" fill={color} opacity="0.6"/>
    {/* Barra de engate */}
    <rect x="13" y="7" width="6" height="4" rx="1" fill={color} opacity="0.5"/>
  </svg>
));
IconSulcador.displayName = 'IconSulcador';

/* ── 26. IMPLEMENTO ──────────────────────────────────────────────────────── */
const IconImplemento: SvgIconFC = memo(({ size = 32, className, color = 'currentColor' }) => (
  <svg {...svgBase(size, className)}>
    {/* Chassi principal */}
    <rect x="8" y="12" width="16" height="8" rx="2" fill={color} opacity="0.75"/>
    {/* Engate traseiro */}
    <rect x="4"  y="14" width="5"  height="4" rx="1" fill={color} opacity="0.5"/>
    {/* Engate dianteiro */}
    <rect x="23" y="14" width="5"  height="4" rx="1" fill={color} opacity="0.5"/>
    {/* Rodas */}
    <circle cx="11" cy="23" r="3" stroke={color} strokeWidth="2" fill="none"/>
    <circle cx="21" cy="23" r="3" stroke={color} strokeWidth="2" fill="none"/>
    {/* Detalhe estrutural */}
    <line x1="12" y1="12" x2="12" y2="8" stroke={color} strokeWidth="1.5" opacity="0.4"/>
    <line x1="20" y1="12" x2="20" y2="8" stroke={color} strokeWidth="1.5" opacity="0.4"/>
    <line x1="12" y1="8"  x2="20" y2="8"  stroke={color} strokeWidth="1.5" opacity="0.4"/>
  </svg>
));
IconImplemento.displayName = 'IconImplemento';

/* ── Registry ────────────────────────────────────────────────────────────── */
const ICON_MAP: Record<EquipmentIconType, SvgIconFC> = {
  TRATOR:              IconTrator,
  COLHEDORA:           IconColhedora,
  TRANSBORDO:          IconTransbordo,
  CAMINHAO:            IconCaminhao,
  CAMINHAO_BASCULANTE: IconCaminhaoBasculante,
  CAMINHAO_PIPA:       IconCaminhaoPipa,
  PLANTADEIRA:         IconPlantadeira,
  PULVERIZADOR:        IconPulverizador,
  PA_CARREGADEIRA:     IconPaCarregadeira,
  MOTONIVELADORA:      IconMotoniveladora,
  ESCAVADEIRA:         IconEscavadeira,
  TRATOR_ESTEIRA:      IconTratorEsteira,
  COMBOIO:             IconComboio,
  BOMBA_COMBUSTIVEL:   IconBombaCombustivel,
  CARRETA_PRANCHA:     IconCarretaPrancha,
  GRADE_IMPLEMENTO:    IconGradeImplemento,
  SILO:                IconSilo,
  TORRE:               IconTorre,
  LEITOR_RFID:         IconLeitorRfid,
  MOBILE:              IconMobile,
  VEICULO:             IconVeiculo,
  MOTO:                IconMoto,
  PLUVIOMETRO:         IconPluviometro,
  PADRAO_GENERICO:     IconPadraoGenerico,
  SULCADOR:            IconSulcador,
  IMPLEMENTO:          IconImplemento,
};

/* ── Componente principal ────────────────────────────────────────────────── */

export interface EquipmentIconProps {
  type: EquipmentIconType | string | null | undefined;
  size?: number;
  className?: string;
  color?: string;
}

/**
 * Renderiza o SVG inline do tipo de equipamento.
 * Fallback automático para PADRAO_GENERICO se type inválido.
 */
export const EquipmentIcon = memo<EquipmentIconProps>(({
  type,
  size = 32,
  className,
  color = 'currentColor',
}) => {
  const resolved = resolveIconType(type);
  const Component = ICON_MAP[resolved];
  return <Component size={size} className={className} color={color} />;
});
EquipmentIcon.displayName = 'EquipmentIcon';

/** Acesso direto ao mapa para renderToString (mapa Leaflet) */
export { ICON_MAP };

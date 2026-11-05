import { useEffect, useRef } from "react";

/**
 * Fundo dinâmico: brilho de ambiente + curvas suaves + luzes que percorrem as curvas.
 * Todas as cores vêm da variável CSS --fx-rgb (ex.: "212, 32, 42"), que o useMarca
 * ajusta conforme a cor primária da academia. Fica atrás de todo o conteúdo.
 */

const CURVES: { d: string; dur: number; off: number }[] = [
  { d: "M-120 720 C 220 499, 470 948, 820 736 S 1380 499, 1740 639", dur: 44, off: -20 },
  { d: "M-120 175 C 220 67, 470 366, 820 229 S 1380 63, 1740 161", dur: 52, off: -29 },
  { d: "M-120 537 C 220 702, 470 291, 820 512 S 1380 678, 1740 578", dur: 38, off: -34 },
  { d: "M-120 764 C 220 488, 470 1068, 820 763 S 1380 515, 1740 664", dur: 58, off: -27 },
  { d: "M-120 225 C 220 78, 470 474, 820 259 S 1380 102, 1740 197", dur: 41, off: -21 },
  { d: "M-120 576 C 220 770, 470 309, 820 536 S 1380 763, 1740 628", dur: 49, off: -28 },
  { d: "M-120 800 C 220 479, 470 1164, 820 784 S 1380 528, 1740 684", dur: 55, off: -12 },
  { d: "M-120 255 C 220 84, 470 539, 820 277 S 1380 126, 1740 218", dur: 36, off: -18 },
  { d: "M-120 511 C 220 656, 470 279, 820 497 S 1380 620, 1740 545", dur: 47, off: -29 },
  { d: "M-120 738 C 220 494, 470 996, 820 746 S 1380 505, 1740 649", dur: 60, off: -46 },
];

// tamanho do rastro de cada camada (em % da curva)
const TRAIL = { w: 16, m: 10, c: 5 } as const;
const FRAME_MS = 1000 / 20 - 2; // ~20 quadros/s: o movimento é lento e poupa bateria
const FRAME_MS_TOQUE = 1000 / 12 - 2; // celular: 12 quadros/s bastam para um movimento lento

/** Aparelhos com poucos núcleos/memória ficam com o fundo parado (só o brilho e as curvas estáticas). */
function aparelhoFraco() {
  const n = navigator as Navigator & { deviceMemory?: number };
  return (n.hardwareConcurrency ?? 8) <= 4 || (n.deviceMemory ?? 8) <= 3;
}

export function FundoAnimado() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    const mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mqSmall = window.matchMedia("(max-width: 820px), (pointer: coarse)");
    const fraco = aparelhoFraco();
    const grupos = Array.from(svg.querySelectorAll<SVGGElement>(".fx-pl"));
    let raf = 0;
    let last = 0;

    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < (mqSmall.matches ? FRAME_MS_TOQUE : FRAME_MS)) return;
      last = t;
      const s = t / 1000;
      const max = mqSmall.matches ? 4 : grupos.length;
      for (let i = 0; i < max; i++) {
        const g = grupos[i];
        if (!g) continue;
        const dur = Number(g.dataset["d"]);
        const off = Number(g.dataset["o"]);
        const p = ((((s - off) / dur) % 1) + 1) % 1; // posição no ciclo, 0..1
        g.style.opacity = String(p < 0.1 ? p * 10 : p > 0.9 ? (1 - p) * 10 : 1);
        const centro = -8 + 116 * p; // começa e termina fora da tela
        for (const path of Array.from(g.children)) {
          const tipo = path.getAttribute("data-k") as keyof typeof TRAIL;
          path.setAttribute("stroke-dashoffset", (TRAIL[tipo] / 2 - centro).toFixed(2));
        }
      }
    };

    const sync = () => {
      const rodar = !mqReduce.matches && !fraco && !document.hidden;
      if (rodar && !raf) raf = requestAnimationFrame(tick);
      else if (!rodar && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    sync();
    document.addEventListener("visibilitychange", sync);
    mqReduce.addEventListener("change", sync);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", sync);
      mqReduce.removeEventListener("change", sync);
    };
  }, []);

  return (
    <>
      <div className="fx-ambient" aria-hidden="true" />
      <svg
        ref={svgRef}
        className="fx-curves"
        viewBox="0 0 1600 1000"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        focusable="false"
      >
        <g className="fx-base">
          {CURVES.map((c) => (
            <path key={c.d} d={c.d} />
          ))}
        </g>
        {CURVES.map((c) => (
          <g key={c.d} className="fx-pl" data-d={c.dur} data-o={c.off}>
            <path data-k="w" className="fx-w" pathLength={100} d={c.d} />
            <path data-k="m" className="fx-m" pathLength={100} d={c.d} />
            <path data-k="c" className="fx-c" pathLength={100} d={c.d} />
          </g>
        ))}
      </svg>
    </>
  );
}

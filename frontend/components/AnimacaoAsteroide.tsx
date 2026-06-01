"use client";
import { useEffect, useMemo, useState } from "react";
import { useGameStore } from "@/store/game";
import { computarCurva } from "@/lib/curve";

export default function AnimacaoAsteroide() {
  const fase         = useGameStore((e) => e.fase);
  const faseDoJogo   = fase === 'RODANDO' ? 'RUNNING' : fase === 'CRASHADO' ? 'CRASHED' : 'BETTING';
  const multiplicador = useGameStore((e) => e.multiplicador);
  const crescimento  = useGameStore((e) => e.crescimento);
  const sacadoEm     = useGameStore((e) => e.sacadoEm);
  const conectar     = useGameStore((e) => e.conectar);

  useEffect(() => {
    conectar(process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4001/jogo");
  }, [conectar]);

  const largura = 1000, altura = 562;

  const { path: caminho, area, tip: ponta, angulo } = useMemo(
    () => computarCurva(multiplicador, crescimento),
    [multiplicador, crescimento],
  );

  // planeta = destino do asteroide (canto superior direito)
  // no mobile o asteroide sobe no mesmo eixo x do planeta → trajetória direta
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    setMobile(mq.matches);
    const fn = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  const planeta = mobile
    ? { x: largura * 0.80, y: altura * 0.18, r: 42 }  // mobile: direto para cima
    : { x: largura * 0.84, y: altura * 0.20, r: 42 };  // desktop: diagonal suave
  const px = planeta.x, py = planeta.y;

  const rodando  = faseDoJogo === "RUNNING";
  const explodido = faseDoJogo === "CRASHED";
  const salvo    = rodando && sacadoEm != null;

  const distancia = Math.hypot(ponta[0] - px, ponta[1] - py);
  const desespero = salvo ? 0 : distancia >= 200 ? 0 : distancia >= 140 ? 1 : distancia >= 90 ? 2 : 3;
  const atingiu  = explodido && distancia < 72;
  const aliviado = salvo || (explodido && !atingiu);

  // rostos do planeta
  const eyeY = py - 7, lx = px - 15, rx = px + 15, my = py + 17;
  const olho = "#e8eef0", pupila = "#0d1018";

  const rostoFeliz = (
    <g>
      <path d={`M ${lx - 7} ${eyeY + 1} Q ${lx} ${eyeY - 7} ${lx + 7} ${eyeY + 1}`} stroke={olho} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d={`M ${rx - 7} ${eyeY + 1} Q ${rx} ${eyeY - 7} ${rx + 7} ${eyeY + 1}`} stroke={olho} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d={`M ${px - 12} ${my - 2} Q ${px} ${my + 10} ${px + 12} ${my - 2}`} stroke={olho} strokeWidth="2.8" fill="none" strokeLinecap="round" />
    </g>
  );

  const tamOlho = [6, 7, 8.5, 10][desespero], tamPupila = [3, 3, 3, 2.5][desespero];
  const boca = desespero <= 0
    ? <path d={`M ${px - 7} ${my} Q ${px} ${my + 3} ${px + 7} ${my}`} stroke={olho} strokeWidth="2.2" fill="none" strokeLinecap="round" />
    : desespero === 1
      ? <path d={`M ${px - 7} ${my + 2} Q ${px} ${my - 4} ${px + 7} ${my + 2}`} stroke={olho} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      : <ellipse cx={px} cy={my + 1} rx={desespero === 2 ? 5 : 7} ry={desespero === 2 ? 5 : 9} fill={pupila} stroke={olho} strokeWidth="1.6" />;

  const rostoMedo = (
    <g>
      {desespero >= 2 && (<>
        <path d={`M ${lx - 8} ${eyeY - tamOlho - 2} L ${lx + 6} ${eyeY - tamOlho - 5}`} stroke={olho} strokeWidth="2" strokeLinecap="round" />
        <path d={`M ${rx + 8} ${eyeY - tamOlho - 2} L ${rx - 6} ${eyeY - tamOlho - 5}`} stroke={olho} strokeWidth="2" strokeLinecap="round" />
      </>)}
      <circle cx={lx} cy={eyeY} r={tamOlho} fill={olho} />
      <circle cx={rx} cy={eyeY} r={tamOlho} fill={olho} />
      <circle cx={lx} cy={eyeY - 2} r={tamPupila} fill={pupila} />
      <circle cx={rx} cy={eyeY - 2} r={tamPupila} fill={pupila} />
      {boca}
    </g>
  );

  const rosto = aliviado ? rostoFeliz : rostoMedo;

  return (
    <svg className="curva" viewBox={`0 0 ${largura} ${altura}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="curvaTraco" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--accent-2)" /><stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
        <linearGradient id="curvaArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(var(--accent-rgb),0.28)" /><stop offset="100%" stopColor="rgba(var(--accent-rgb),0)" />
        </linearGradient>
        <filter id="brilho"><feGaussianBlur stdDeviation="6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <filter id="brilhoFogo" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <radialGradient id="gradPlaneta" cx="38%" cy="34%" r="75%">
          <stop offset="0%" stopColor="#3a4a6b" /><stop offset="55%" stopColor="#222a44" /><stop offset="100%" stopColor="#121627" />
        </radialGradient>
        <radialGradient id="gradChama" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#eafff4" /><stop offset="35%" stopColor="var(--accent)" /><stop offset="100%" stopColor="rgba(var(--accent-rgb),0)" />
        </radialGradient>
        <radialGradient id="gradExplosao" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff" /><stop offset="30%" stopColor="var(--accent)" /><stop offset="70%" stopColor="var(--danger)" /><stop offset="100%" stopColor="rgba(var(--danger-rgb),0)" />
        </radialGradient>
      </defs>

      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} className="linha-grade" x1="0" y1={altura * f} x2={largura} y2={altura * f} />
      ))}

      {(rodando || (explodido && !atingiu)) && (
        <g className={`planeta ${salvo ? "salvo" : aliviado ? "seguro" : "n" + desespero}`}>
          <circle cx={px} cy={py} r={planeta.r + 12}
            fill={`rgba(var(--${rodando && desespero >= 3 && !aliviado ? "danger" : "accent"}-rgb),0.08)`}
            filter="url(#brilho)" />
          {salvo && (
            <circle className="escudo" cx={px} cy={py} r={planeta.r + 16}
              fill="rgba(var(--accent-rgb),0.05)" stroke="var(--accent)" strokeWidth="2.5" />
          )}
          <circle cx={px} cy={py} r={planeta.r} fill="url(#gradPlaneta)"
            stroke={aliviado ? "var(--accent)" : desespero >= 3 ? "var(--danger)" : "rgba(var(--accent-rgb),0.35)"}
            strokeWidth={!aliviado && desespero >= 3 ? 2.5 : 1.5} />
          <ellipse cx={px} cy={py} rx={planeta.r + 22} ry="9" fill="none"
            stroke="rgba(var(--accent-rgb),0.25)" strokeWidth="2"
            transform={`rotate(-18 ${px} ${py})`} />
          <circle cx={px - 22} cy={py + 18} r="6" fill="rgba(0,0,0,0.18)" />
          <circle cx={px + 20} cy={py + 20} r="4" fill="rgba(0,0,0,0.16)" />
          {rosto}
          {rodando && desespero >= 3 && !salvo && (
            <g className="suor">
              <path d={`M ${px - planeta.r + 6} ${py - 2} q -4 7 0 10 q 4 -3 0 -10 Z`} fill="#9fd8ff" />
              <path className="s2" d={`M ${px + planeta.r - 6} ${py + 2} q -4 7 0 10 q 4 -3 0 -10 Z`} fill="#9fd8ff" />
            </g>
          )}
        </g>
      )}

      {rodando && !salvo && desespero >= 3 && (
        <g className="alerta" transform={`translate(${px + 38} ${py - 50})`}>
          <circle r="17" fill="var(--danger)" />
          <circle r="17" fill="none" stroke="var(--danger)" strokeWidth="2" className="alerta-anel" />
          <text x="0" y="6" textAnchor="middle" fontFamily="var(--font-mono)" fontWeight="800" fontSize="22" fill="#fff">!</text>
        </g>
      )}

      {(rodando || explodido) && (
        <>
          <path d={area} fill="url(#curvaArea)" style={{ transition: "none" }} />
          <path d={caminho} fill="none"
            stroke={explodido ? "var(--danger)" : "url(#curvaTraco)"}
            strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
            filter="url(#brilho)" style={{ transition: "none" }} />

          {rodando && (
            <g transform={`translate(${ponta[0]} ${ponta[1]}) rotate(${angulo})`} style={{ transition: "none" }}>
              <g filter="url(#brilhoFogo)">
                <path className="chama chama-externa" d="M 6 0 C -26 -16, -64 -9, -96 0 C -64 9, -26 16, 6 0 Z" fill="url(#gradChama)" />
                <path className="chama chama-interna" d="M 4 0 C -16 -8, -40 -5, -58 0 C -40 5, -16 8, 4 0 Z" fill="#eafff4" opacity="0.9" />
                <circle className="brasa b1" cx="-70" cy="-4" r="3.5" fill="var(--accent)" />
                <circle className="brasa b2" cx="-86" cy="5"  r="2.5" fill="#eafff4" />
                <circle className="brasa b3" cx="-58" cy="6"  r="2.5" fill="var(--accent)" />
              </g>
              <g transform="rotate(-90)">
                <path d="M -13 -7 L -3 -14 L 9 -12 L 16 -3 L 13 9 L 2 15 L -10 11 L -16 1 Z"
                  fill="#5b6470" stroke="rgba(var(--accent-rgb),0.9)" strokeWidth="1.5" />
                <path d="M -13 -7 L -3 -14 L 9 -12 L 16 -3 Z" fill="#6e7682" />
                <circle cx="-3" cy="2"  r="3.2" fill="#3c434d" />
                <circle cx="6"  cy="-3" r="2.2" fill="#3c434d" />
                <circle cx="-7" cy="-4" r="1.6" fill="#444c56" />
                <circle cx="4"  cy="7"  r="1.8" fill="#3c434d" />
              </g>
            </g>
          )}

          {explodido && (
            <g transform={`translate(${ponta[0]} ${ponta[1]})`} className="explosao">
              <circle className="exp-flash"  r="70" fill="url(#gradExplosao)" />
              <circle className="exp-nucleo" r="38" fill="url(#gradExplosao)" />
              <circle className="exp-anel"    r="18" fill="none" stroke="var(--danger)" strokeWidth="4" />
              <circle className="exp-anel a2" r="18" fill="none" stroke="var(--accent)" strokeWidth="2.5" />
              {[0, 40, 80, 120, 160, 200, 240, 280, 320].map((a, i) => (
                <rect key={"ad" + a} className="exp-detrito" x="-4" y="-4"
                  width={i % 3 === 0 ? 9 : 6} height={i % 3 === 0 ? 9 : 6} rx="2"
                  fill={i % 3 === 0 ? "#5b6470" : i % 3 === 1 ? "var(--accent)" : "var(--danger)"}
                  transform={`rotate(${a * 1.4})`}
                  style={{
                    "--dx": `${Math.cos((a * Math.PI) / 180) * (72 + (i % 3) * 18)}px`,
                    "--dy": `${Math.sin((a * Math.PI) / 180) * (72 + (i % 3) * 18)}px`,
                  } as React.CSSProperties} />
              ))}
            </g>
          )}

          {atingiu && (
            <g transform={`translate(${px} ${py})`} className="explosao">
              <circle className="exp-flash"  r="120" fill="url(#gradExplosao)" />
              <circle className="exp-nucleo" r="64"  fill="url(#gradExplosao)" />
              <circle className="exp-anel"    r="30" fill="none" stroke="var(--danger)" strokeWidth="5" />
              <circle className="exp-anel a2" r="30" fill="none" stroke="var(--accent)" strokeWidth="3" />
              <circle className="exp-anel a3" r="30" fill="none" stroke="#fff" strokeWidth="2" />
              {[[-40, -20, 26], [38, -28, 22], [-30, 30, 24], [44, 24, 20], [0, -48, 22], [8, 44, 24]].map(([sx, sy, sr], i) => (
                <circle key={"sm" + i} className="exp-fumaca" cx={sx} cy={sy} r={sr}
                  fill="rgba(40,46,58,0.55)"
                  style={{
                    "--sx": `${sx * 1.7}px`,
                    "--sy": `${sy * 1.7}px`,
                  } as React.CSSProperties} />
              ))}
              {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a, i) => (
                <rect key={"db" + a} className="exp-detrito" x="-5" y="-5"
                  width={i % 3 === 0 ? 11 : 7} height={i % 3 === 0 ? 11 : 7} rx="2"
                  fill={i % 3 === 0 ? "var(--danger)" : i % 3 === 1 ? "var(--accent)" : "#3a4a6b"}
                  transform={`rotate(${a * 1.3})`}
                  style={{
                    "--dx": `${Math.cos((a * Math.PI) / 180) * (110 + (i % 4) * 22)}px`,
                    "--dy": `${Math.sin((a * Math.PI) / 180) * (110 + (i % 4) * 22)}px`,
                  } as React.CSSProperties} />
              ))}
            </g>
          )}
        </>
      )}
    </svg>
  );
}

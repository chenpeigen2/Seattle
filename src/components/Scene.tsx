import type { Phase, Weather } from "../lib/types";
import RainCanvas from "./RainCanvas";

interface Props {
  weather: Weather;
  phase: Phase;
  reducedMotion: boolean;
}

interface Building {
  x: number;
  y: number;
  w: number;
  h: number;
}

const BUILDINGS: Building[] = [
  { x: 22, y: 474, w: 54, h: 48 },
  { x: 82, y: 452, w: 38, h: 70 },
  { x: 126, y: 482, w: 66, h: 40 },
  { x: 198, y: 466, w: 36, h: 56 },
  { x: 240, y: 488, w: 58, h: 34 },
  { x: 345, y: 470, w: 50, h: 52 },
  { x: 401, y: 446, w: 34, h: 76 },
  { x: 441, y: 478, w: 56, h: 44 },
  { x: 506, y: 460, w: 42, h: 62 },
  { x: 552, y: 428, w: 34, h: 94 },
  { x: 594, y: 452, w: 46, h: 70 },
  { x: 646, y: 406, w: 46, h: 116 },
  { x: 698, y: 350, w: 56, h: 172 },
  { x: 760, y: 444, w: 36, h: 78 },
  { x: 800, y: 470, w: 52, h: 52 },
  { x: 856, y: 456, w: 40, h: 66 },
  { x: 902, y: 480, w: 58, h: 42 },
  { x: 968, y: 464, w: 34, h: 58 },
  { x: 1010, y: 482, w: 68, h: 40 },
  { x: 1086, y: 470, w: 46, h: 52 },
  { x: 1138, y: 486, w: 48, h: 36 },
];

const STARS = Array.from({ length: 42 }, (_, index) => ({
  x: 26 + ((index * 197.3) % 1140),
  y: 28 + ((index * 83.7) % 300),
  r: 0.55 + (index % 4) * 0.32,
  delay: (index % 9) * 0.9,
  bright: index % 7 === 0,
}));

const HILL_LIGHTS = Array.from({ length: 22 }, (_, index) => ({
  x: 40 + ((index * 71.9) % 520),
  y: 470 + ((index * 37.1) % 44),
  delay: (index % 6) * 1.3,
}));

function windowsFor(building: Building, index: number) {
  const columns = Math.max(1, Math.floor((building.w - 10) / 13));
  const rows = Math.max(1, Math.floor((building.h - 14) / 17));
  const windows: { x: number; y: number; delay: number }[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if ((row * 7 + column * 11 + index * 5) % 13 > 4) continue;
      windows.push({
        x: building.x + 7 + column * 13,
        y: building.y + 9 + row * 17,
        delay: ((row * 3 + column * 2 + index) % 10) * 0.7,
      });
    }
  }
  return windows;
}

export default function Scene({ weather, phase, reducedMotion }: Props) {
  const wet = weather.kind === "rain" || weather.kind === "drizzle" || weather.kind === "storm" || weather.kind === "snow";

  return (
    <div className={`scene phase-${phase} wx-${weather.kind} ${reducedMotion ? "reduced" : ""}`} aria-hidden="true">
      <svg className="scene-art" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="skyGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--sky-1)" />
            <stop offset="0.62" stopColor="var(--sky-2)" />
            <stop offset="1" stopColor="var(--sky-3)" />
          </linearGradient>
          <linearGradient id="waterGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--water-1)" />
            <stop offset="0.5" stopColor="var(--water-2)" />
            <stop offset="1" stopColor="var(--water-3)" />
          </linearGradient>
          <radialGradient id="horizonGlow">
            <stop offset="0" stopColor="var(--glow)" stopOpacity="0.42" />
            <stop offset="0.55" stopColor="var(--glow)" stopOpacity="0.12" />
            <stop offset="1" stopColor="var(--glow)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sunGlow">
            <stop offset="0" stopColor="var(--sun)" stopOpacity="0.85" />
            <stop offset="0.4" stopColor="var(--sun)" stopOpacity="0.24" />
            <stop offset="1" stopColor="var(--sun)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="waterHaze" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--haze)" stopOpacity="0.5" />
            <stop offset="1" stopColor="var(--haze)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="moonColumn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--moon)" stopOpacity="0.2" />
            <stop offset="1" stopColor="var(--moon)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="columnFade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <mask id="columnMask">
            <rect x="836" y="520" width="204" height="280" fill="url(#columnFade)" />
          </mask>
          <filter id="cloudBlur" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="24" />
          </filter>
          <filter id="softBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <filter id="watercolor" x="-8%" y="-8%" width="116%" height="116%">
            <feTurbulence type="fractalNoise" baseFrequency="0.008 0.019" numOctaves="3" seed="11" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="8" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="inkSoft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="0.7" />
          </filter>
        </defs>

        <rect width="1200" height="800" fill="url(#skyGradient)" />
        <ellipse cx="905" cy="405" rx="420" ry="250" fill="url(#horizonGlow)" />

        <g className="stars">
          {STARS.map((star, index) => (
            <g key={index}>
              {star.bright && (
                <circle cx={star.x} cy={star.y} r={star.r * 4.8} fill="var(--star)" opacity="0.09" />
              )}
              <circle
                cx={star.x}
                cy={star.y}
                r={star.r}
                fill="var(--star)"
                className="twinkle"
                style={{ animationDelay: `${star.delay}s` }}
                opacity={star.bright ? 0.9 : 0.55}
              />
            </g>
          ))}
        </g>

        <g className="moon">
          <circle cx="938" cy="176" r="102" fill="var(--moon)" opacity="0.07" filter="url(#cloudBlur)" />
          <circle cx="938" cy="176" r="42" fill="var(--moon)" opacity="0.14" filter="url(#cloudBlur)" />
          <circle cx="938" cy="176" r="27" fill="var(--moon)" opacity="0.9" />
          <circle cx="948" cy="168" r="5" fill="var(--moon-shade)" opacity="0.18" />
          <circle cx="930" cy="184" r="3.5" fill="var(--moon-shade)" opacity="0.12" />
          <circle cx="944" cy="187" r="2.2" fill="var(--moon-shade)" opacity="0.14" />
        </g>

        <g className="sun">
          <circle cx="890" cy="168" r="180" fill="url(#sunGlow)" />
          <circle cx="890" cy="168" r="20" fill="var(--sun)" opacity="0.5" filter="url(#softBlur)" />
        </g>

        <g className="clouds">
          <g className="cloud cloud-a" filter="url(#cloudBlur)">
            <ellipse cx="230" cy="196" rx="286" ry="74" fill="var(--cloud)" />
            <ellipse cx="430" cy="222" rx="232" ry="54" fill="var(--cloud)" />
            <ellipse cx="88" cy="238" rx="190" ry="48" fill="var(--cloud)" />
          </g>
          <g className="cloud cloud-b" filter="url(#cloudBlur)">
            <ellipse cx="880" cy="294" rx="330" ry="64" fill="var(--cloud)" />
            <ellipse cx="1080" cy="266" rx="230" ry="50" fill="var(--cloud)" />
            <ellipse cx="700" cy="312" rx="190" ry="40" fill="var(--cloud)" />
          </g>
          <g className="cloud cloud-c" filter="url(#cloudBlur)">
            <ellipse cx="500" cy="368" rx="390" ry="46" fill="var(--cloud)" />
            <ellipse cx="960" cy="392" rx="310" ry="40" fill="var(--cloud)" />
          </g>
        </g>

        <g className="land">
          <path
            className="hills-far"
            d="M-40 492 C 90 446 168 466 262 444 C 364 420 436 456 528 438 C 646 416 702 450 804 430 C 928 406 1034 448 1240 416 L1240 540 L-40 540 Z"
            fill="var(--hill-far)"
            filter="url(#watercolor)"
          />
          <path
            className="hills-near"
            d="M-30 516 C 120 486 218 510 330 490 C 452 468 520 500 640 486 C 780 468 850 502 980 490 C 1070 482 1140 500 1230 490 L1230 540 L-30 540 Z"
            fill="var(--hill-near)"
            filter="url(#watercolor)"
          />
          <g className="hill-lights">
            {HILL_LIGHTS.map((light, index) => (
              <circle
                key={index}
                cx={light.x}
                cy={light.y}
                r={1.2}
                fill="var(--window-glow)"
                className="twinkle"
                style={{ animationDelay: `${light.delay}s` }}
                opacity="0.44"
              />
            ))}
          </g>
        </g>

        <g className="skyline" filter="url(#watercolor)">
          {BUILDINGS.map((building, index) => (
            <g key={index}>
              <rect x={building.x} y={building.y} width={building.w} height={building.h} fill="var(--city)" />
              <rect x={building.x} y={building.y} width={building.w} height="2.4" fill="var(--city-edge)" opacity="0.7" />
            </g>
          ))}
          <path d="M548 428 L569 400 L590 428 Z" fill="var(--city)" />
          <rect x="568" y="390" width="2" height="12" fill="var(--city)" />
          <rect x="706" y="330" width="40" height="22" fill="var(--city)" />
          <rect x="723" y="312" width="2.6" height="20" fill="var(--city)" />
          <rect x="668" y="438" width="2" height="24" fill="var(--city)" />
          <rect x="744" y="446" width="2" height="18" fill="var(--city)" />
        </g>

        <g className="needle" filter="url(#watercolor)">
          <path d="M284 522 L296 436 L300 436 L302 522 Z" fill="var(--city)" />
          <path d="M318 522 L304 436 L300 436 L298 522 Z" fill="var(--city)" />
          <rect x="296" y="390" width="8" height="48" fill="var(--city)" />
          <ellipse cx="300" cy="386" rx="24" ry="6.4" fill="var(--city)" />
          <rect x="278" y="386" width="44" height="5" rx="2" fill="var(--city)" />
          <rect x="298" y="362" width="4" height="24" fill="var(--city)" />
          <path d="M300 362 L300 326" stroke="var(--city)" strokeWidth="2.4" />
          <rect x="288" y="388" width="24" height="1.4" fill="var(--window-glow)" opacity="0.7" />
        </g>

        <g className="cranes" stroke="var(--city)" fill="none" strokeWidth="3">
          <path d="M934 522 L934 438 M964 522 L964 438 M934 438 L964 438 M920 438 L986 438 M940 438 L952 522" />
          <path d="M1008 522 L1008 452 M1032 522 L1032 452 M1008 452 L1032 452 M994 452 L1050 452" />
          <path d="M920 438 L880 448" />
          <circle cx="880" cy="448" r="2.4" fill="var(--signal)" stroke="none" className="signal-blink" />
        </g>

        <g className="city-lights">
          {BUILDINGS.map((building, index) =>
            windowsFor(building, index).map((lit, windowIndex) => (
              <rect
                key={`${index}-${windowIndex}`}
                x={lit.x}
                y={lit.y}
                width="2.8"
                height="3.8"
                fill="var(--window-glow)"
                className="twinkle"
                style={{ animationDelay: `${lit.delay + 1.7}s` }}
                opacity="0.78"
              />
            )),
          )}
          <rect x="300" y="376" width="2" height="2" fill="var(--window-glow)" opacity="0.9" />
          <rect x="312" y="378" width="2" height="2" fill="var(--window-glow)" opacity="0.65" />
          <path d="M934 438 L964 438" stroke="var(--window-glow)" strokeWidth="1" opacity="0.5" />
          <path d="M1008 452 L1032 452" stroke="var(--window-glow)" strokeWidth="1" opacity="0.4" />
        </g>

        <g className="shoreline">
          <path d="M0 522 L1200 522" stroke="var(--shore)" strokeWidth="1.2" opacity="0.5" />
          <rect x="70" y="512" width="2" height="12" fill="var(--city)" />
          <rect x="134" y="508" width="2" height="16" fill="var(--city)" />
          <rect x="458" y="511" width="2" height="13" fill="var(--city)" />
          <rect x="880" y="508" width="2" height="16" fill="var(--city)" />
        </g>

        <rect x="0" y="522" width="1200" height="278" fill="url(#waterGradient)" />
        <rect x="0" y="518" width="1200" height="92" fill="url(#waterHaze)" />

        <g className="water-reflection">
          <ellipse cx="690" cy="595" rx="330" ry="72" fill="var(--glow)" opacity="0.1" filter="url(#cloudBlur)" />
          <rect
            x="836"
            y="522"
            width="204"
            height="278"
            fill="url(#moonColumn)"
            mask="url(#columnMask)"
            className="moon-column"
          />
          {BUILDINGS.filter((_, index) => index % 2 === 0).map((building, index) => (
            <rect
              key={index}
              x={building.x + building.w * 0.35}
              y="528"
              width={Math.min(4, building.w * 0.08)}
              height={18 + (index % 5) * 13}
              fill="var(--window-glow)"
              opacity="0.11"
              filter="url(#softBlur)"
            />
          ))}
          <path d="M120 606 C 280 600 360 610 520 604" stroke="var(--ripple)" strokeWidth="1.4" opacity="0.24" fill="none" />
          <path d="M620 662 C 760 656 900 666 1080 658" stroke="var(--ripple)" strokeWidth="1.1" opacity="0.18" fill="none" />
          <path d="M240 714 C 420 708 540 718 760 710" stroke="var(--ripple)" strokeWidth="1.2" opacity="0.14" fill="none" />
          <path d="M780 748 C 900 744 1010 750 1160 744" stroke="var(--ripple)" strokeWidth="0.9" opacity="0.12" fill="none" />
        </g>

        <g transform="translate(0 638)">
          <g className="ferry">
            <path d="M0 18 L132 18 L118 38 L16 38 Z" fill="var(--ferry)" opacity="0.78" />
            <rect x="32" y="1" width="64" height="18" rx="2" fill="var(--ferry)" opacity="0.88" />
            <rect x="40" y="7" width="5" height="5" fill="var(--window-glow)" opacity="0.9" />
            <rect x="50" y="7" width="5" height="5" fill="var(--window-glow)" opacity="0.6" />
            <rect x="60" y="7" width="5" height="5" fill="var(--window-glow)" opacity="0.85" />
            <rect x="70" y="7" width="5" height="5" fill="var(--window-glow)" opacity="0.5" />
            <rect x="80" y="7" width="5" height="5" fill="var(--window-glow)" opacity="0.75" />
            <rect x="98" y="8" width="12" height="11" fill="var(--ferry-stack)" opacity="0.85" />
            <path d="M12 18 L120 18" stroke="var(--ferry-line)" strokeWidth="1.6" opacity="0.55" />
            <path d="M-20 41 C -50 43 -80 43 -120 45" stroke="var(--ripple)" strokeWidth="1.2" fill="none" opacity="0.35" />
            <circle cx="104" cy="4" r="1.6" fill="var(--signal)" className="signal-blink" />
          </g>
        </g>
      </svg>

      <RainCanvas kind={weather.kind} intensity={weather.intensity} reducedMotion={reducedMotion} />

      <div className="glass">
        <div className="fog-wash" />
        <div className="fog-bank fog-bank-a" />
        <div className="fog-bank fog-bank-b" />
        <div className="fog-bank fog-bank-c" />
        <div className="glass-reflection" />
        <div className="fog-texture" />
        <svg className="wipe-traces" viewBox="0 0 1000 700" preserveAspectRatio="none">
          <path d="M86 616 C 148 580 190 590 248 620" />
          <path d="M760 212 C 806 188 852 196 896 224" />
          <path d="M610 624 C 646 610 684 612 720 628" />
        </svg>
        <div className="droplet droplet-a" />
        <div className="droplet droplet-b" />
        <div className="droplet droplet-c" />
        <div className="droplet droplet-d" />
        <div className="droplet droplet-e" />
        {wet && <div className="glass-rain-haze" />}
        <div className="glass-edge" />
        <div className="glass-vignette" />
      </div>
    </div>
  );
}

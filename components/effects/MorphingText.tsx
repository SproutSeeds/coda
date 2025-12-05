"use client";

import { useEffect, useRef, useId } from "react";

interface MorphingTextProps {
  texts: string[];
  morphTime?: number;
  cooldownTime?: number;
  className?: string;
}

export function MorphingText({
  texts,
  morphTime = 1,
  cooldownTime = 0.25,
  className = "",
}: MorphingTextProps) {
  const text1Ref = useRef<HTMLSpanElement>(null);
  const text2Ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  const filterId = `threshold${id.replace(/:/g, "")}`;

  useEffect(() => {
    if (!text1Ref.current || !text2Ref.current || texts.length === 0) return;

    const elts = {
      text1: text1Ref.current,
      text2: text2Ref.current,
    };

    let textIndex = texts.length - 1;
    let time = Date.now();
    let morph = 0;
    let cooldown = cooldownTime;
    let animationId: number;

    elts.text1.textContent = texts[textIndex % texts.length];
    elts.text2.textContent = texts[(textIndex + 1) % texts.length];

    function setMorph(fraction: number) {
      elts.text2.style.filter = `blur(${Math.min(8 / fraction - 8, 100)}px)`;
      elts.text2.style.opacity = `${Math.pow(fraction, 0.4) * 100}%`;

      const inverseFraction = 1 - fraction;
      elts.text1.style.filter = `blur(${Math.min(8 / inverseFraction - 8, 100)}px)`;
      elts.text1.style.opacity = `${Math.pow(inverseFraction, 0.4) * 100}%`;

      elts.text1.textContent = texts[textIndex % texts.length];
      elts.text2.textContent = texts[(textIndex + 1) % texts.length];
    }

    function doMorph() {
      morph -= cooldown;
      cooldown = 0;

      let fraction = morph / morphTime;

      if (fraction > 1) {
        cooldown = cooldownTime;
        fraction = 1;
      }

      setMorph(fraction);
    }

    function doCooldown() {
      morph = 0;

      elts.text2.style.filter = "";
      elts.text2.style.opacity = "100%";

      elts.text1.style.filter = "";
      elts.text1.style.opacity = "0%";
    }

    function animate() {
      animationId = requestAnimationFrame(animate);

      const newTime = Date.now();
      const shouldIncrementIndex = cooldown > 0;
      const dt = (newTime - time) / 1000;
      time = newTime;

      cooldown -= dt;

      if (cooldown <= 0) {
        if (shouldIncrementIndex) {
          textIndex++;
        }
        doMorph();
      } else {
        doCooldown();
      }
    }

    animate();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [texts, morphTime, cooldownTime]);

  return (
    <>
      {/* SVG filter for the threshold/gooey effect */}
      <svg className="absolute w-0 h-0" aria-hidden="true">
        <defs>
          <filter id={filterId}>
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      0 0 0 255 -140"
            />
          </filter>
        </defs>
      </svg>

      {/* Text container with filter applied */}
      <div
        className={`relative inline-block ${className}`}
        style={{
          filter: `url(#${filterId}) blur(0.6px)`,
        }}
      >
        <span
          ref={text1Ref}
          className="absolute left-0 top-0 select-none whitespace-nowrap"
          style={{ opacity: 0 }}
        />
        <span
          ref={text2Ref}
          className="absolute left-0 top-0 select-none whitespace-nowrap"
        >
          {texts[0]}
        </span>
        {/* Invisible spacer to maintain container width */}
        <span className="whitespace-nowrap opacity-0" aria-hidden="true">{texts.reduce((a, b) => a.length > b.length ? a : b)}</span>
      </div>
    </>
  );
}

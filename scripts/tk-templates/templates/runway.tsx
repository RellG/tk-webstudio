/**
 * TK template: Runway (ecom apparel — Spring/Summer drop).
 *
 * Hand-port of `tk-gallery/app/templates/runway/page.tsx` into the Webstudio
 * `ws.element` + `css` DSL. Pass the exported `runwayPage` JSX into
 * `renderData()` from `@webstudio-is/template` to produce a `WebstudioData`
 * blob for provisioning.
 *
 * Fidelity notes:
 *   - Layout, typography, colors, gradients, spacing match the original 1:1.
 *   - Framer-motion entry animation (opacity 0→1, y 18→0) on the hero copy is
 *     intentionally omitted — Webstudio handles entry animation differently.
 *     The rendered surface is visually equivalent at rest.
 *   - `data-brand-*` / `data-accent-*` attributes are preserved on the
 *     corresponding instances so the marketing-site customization contract
 *     keeps working.
 */
import { css, ws } from "@webstudio-is/template";

const POSTER_URL =
  "https://images.pexels.com/photos/3763194/pexels-photo-3763194.jpeg?auto=compress&w=1600";
const VIDEO_URL =
  "https://videos.pexels.com/video-files/5946140/5946140-hd_1920_1080_25fps.mp4";

export const runwayHero = (
  <ws.element
    ws:tag="section"
    ws:style={css`
      position: relative;
      width: 100%;
      height: 760px;
      overflow: hidden;
    `}
  >
    <ws.element
      ws:tag="video"
      data-brand-hero=""
      autoplay
      loop
      muted
      playsinline
      poster={POSTER_URL}
      ws:style={css`
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
      `}
    >
      <ws.element ws:tag="source" src={VIDEO_URL} type="video/mp4" />
    </ws.element>

    {/* dark gradient overlay */}
    <ws.element
      ws:tag="div"
      ws:style={css`
        position: absolute;
        inset: 0;
        background-image: linear-gradient(
          to bottom,
          rgba(0, 0, 0, 0.15),
          rgba(0, 0, 0, 0) 50%,
          rgba(0, 0, 0, 0.4)
        );
      `}
    />

    {/* content column */}
    <ws.element
      ws:tag="div"
      ws:style={css`
        position: relative;
        z-index: 10;
        height: 100%;
        display: flex;
        flex-direction: column;
      `}
    >
      <ws.element
        ws:tag="div"
        ws:style={css`
          flex: 1;
          display: flex;
          align-items: flex-end;
          padding-bottom: 80px;
          padding-left: 24px;
          padding-right: 24px;
          @media (min-width: 1024px) {
            padding-left: 40px;
            padding-right: 40px;
          }
        `}
      >
        <ws.element
          ws:tag="div"
          ws:style={css`
            max-width: 42rem;
            color: #ffffff;
          `}
        >
          <ws.element
            ws:tag="div"
            ws:style={css`
              font-size: 11px;
              letter-spacing: 0.22em;
              text-transform: uppercase;
              margin-bottom: 20px;
              opacity: 0.9;
            `}
          >
            Spring · Summer 26
          </ws.element>
          <ws.element
            ws:tag="h1"
            data-brand-tagline=""
            ws:style={css`
              font-size: 58px;
              line-height: 0.95;
              letter-spacing: -0.025em;
              font-weight: 700;
              margin-bottom: 24px;
              @media (min-width: 768px) {
                font-size: 88px;
              }
            `}
          >
            Light layers,
            <ws.element ws:tag="br" />
            long days.
          </ws.element>
          <ws.element
            ws:tag="p"
            ws:style={css`
              font-size: 16px;
              line-height: 1.6;
              color: rgba(255, 255, 255, 0.9);
              max-width: 28rem;
              margin-bottom: 36px;
              @media (min-width: 768px) {
                font-size: 18px;
              }
            `}
          >
            The new collection lands today. 240+ pieces, 0 promises about
            "forever." Wear it now, wear it loud.
          </ws.element>
          <ws.element
            ws:tag="div"
            ws:style={css`
              display: flex;
              flex-wrap: wrap;
              align-items: center;
              gap: 12px;
            `}
          >
            <ws.element
              ws:tag="button"
              data-accent-bg=""
              ws:style={css`
                height: 48px;
                padding-left: 32px;
                padding-right: 32px;
                background-color: #ffffff;
                color: #000000;
                font-size: 12.5px;
                letter-spacing: 0.18em;
                text-transform: uppercase;
                font-weight: 700;
                border: 0;
                cursor: pointer;
                transition:
                  background-color 150ms,
                  color 150ms;
                &:hover {
                  background-color: #0000c5;
                  color: #ffffff;
                }
              `}
            >
              <ws.element ws:tag="span" data-brand-cta-primary="">
                Shop women
              </ws.element>
            </ws.element>
            <ws.element
              ws:tag="button"
              ws:style={css`
                height: 48px;
                padding-left: 32px;
                padding-right: 32px;
                background-color: transparent;
                color: #ffffff;
                font-size: 12.5px;
                letter-spacing: 0.18em;
                text-transform: uppercase;
                font-weight: 700;
                border: 2px solid #ffffff;
                cursor: pointer;
                transition:
                  background-color 150ms,
                  color 150ms;
                &:hover {
                  background-color: #ffffff;
                  color: #000000;
                }
              `}
            >
              Shop men
            </ws.element>
          </ws.element>
        </ws.element>
      </ws.element>
    </ws.element>
  </ws.element>
);

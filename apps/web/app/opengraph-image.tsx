import { ImageResponse } from 'next/og';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Vera Calloway — AI AR Intelligence';

export default function OpenGraphImage() {
  const avatarBuffer = readFileSync(
    join(process.cwd(), 'public', 'vera-avatar.png'),
  );
  const avatarDataUrl = `data:image/png;base64,${avatarBuffer.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1A1614 0%, #2A1F18 100%)',
          color: '#FFFFFF',
          fontFamily: 'Georgia, Times New Roman, serif',
          padding: 80,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarDataUrl}
          alt=""
          width={220}
          height={220}
          style={{ borderRadius: 9999, marginBottom: 48 }}
        />
        <div
          style={{
            fontSize: 88,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
            textAlign: 'center',
          }}
        >
          Vera Calloway
        </div>
        <div
          style={{
            marginTop: 20,
            fontSize: 36,
            color: '#C8854E',
            fontFamily: 'Inter, system-ui, sans-serif',
            letterSpacing: '0.02em',
            textAlign: 'center',
          }}
        >
          AI Accounts Receivable Intelligence
        </div>
      </div>
    ),
    { ...size },
  );
}

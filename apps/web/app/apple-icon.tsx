import { ImageResponse } from 'next/og';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const runtime = 'nodejs';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/**
 * iOS clips home-screen icons to a rounded square automatically, so the
 * shape we ship just needs to be a circular avatar on a brand-coloured
 * background — iOS handles the corner radius.
 */

export default function AppleIcon() {
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
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1A1614',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarDataUrl}
          alt=""
          width={156}
          height={156}
          style={{
            borderRadius: 9999,
            objectFit: 'cover',
          }}
        />
      </div>
    ),
    { ...size },
  );
}

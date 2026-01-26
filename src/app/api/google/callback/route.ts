import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_SERVICE_URL = process.env.GOOGLE_SERVICE_URL || 'http://localhost:3003';
const FRONTEND_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Handle errors from Google
  if (error) {
    return NextResponse.redirect(
      `${FRONTEND_URL}/dashboard/settings/profile?error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${FRONTEND_URL}/dashboard/settings/profile?error=${encodeURIComponent('Missing authorization code')}`
    );
  }

  try {
    // Forward the callback to Google Service
    const response = await fetch(
      `${GOOGLE_SERVICE_URL}/oauth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
      { redirect: 'manual' }
    );

    // The Google Service will redirect, so we follow that redirect
    const location = response.headers.get('location');
    if (location) {
      return NextResponse.redirect(location);
    }

    // If no redirect, assume success
    return NextResponse.redirect(`${FRONTEND_URL}/dashboard/settings/profile?success=google_connected`);
  } catch (error) {
    console.error('Google callback error:', error);
    return NextResponse.redirect(
      `${FRONTEND_URL}/dashboard/settings/profile?error=${encodeURIComponent('Failed to complete authorization')}`
    );
  }
}

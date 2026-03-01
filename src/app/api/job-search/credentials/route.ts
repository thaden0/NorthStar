import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/encryption';

// GET - list all saved credentials (without passwords)
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const credentials = await (db as unknown as Record<string, { findMany: (args: unknown) => Promise<unknown[]> }>).jobBoardCredential.findMany({
    where: { userId: session.userId },
    select: { id: true, board: true, email: true, updatedAt: true },
    orderBy: { board: 'asc' },
  });

  return NextResponse.json({ credentials });
}

// POST - save or update a credential
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { board, email, password } = await req.json();

  if (!board || !email || !password) {
    return NextResponse.json({ error: 'Board, email, and password are required' }, { status: 400 });
  }

  const passwordEnc = encrypt(password);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const credential = await (db as any).jobBoardCredential.upsert({
    where: {
      userId_board: { userId: session.userId, board },
    },
    update: { email, passwordEnc },
    create: {
      userId: session.userId,
      board,
      email,
      passwordEnc,
    },
    select: { id: true, board: true, email: true, updatedAt: true },
  });

  return NextResponse.json({ credential });
}

// DELETE - remove a credential
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { board } = await req.json();
  if (!board) return NextResponse.json({ error: 'Board is required' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any).jobBoardCredential.deleteMany({
    where: { userId: session.userId, board },
  });

  return NextResponse.json({ success: true });
}

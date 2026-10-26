import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Body, Button, Caption, Card, ErrorNote, Field, H2, Hero, Icon, Row, Screen, Stack } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { useAuth } from '@/data';
import type { Role } from '@/data/types';

const FEATURES = [
  { icon: 'calendar' as const, text: 'Live game schedule, scores and brackets' },
  { icon: 'qr-code' as const, text: 'Player check-in QR code for arrival day' },
  { icon: 'notifications' as const, text: 'Instant alerts for delays and weather' },
  { icon: 'camera' as const, text: 'Book photo sessions and order team photos' },
];

export default function Welcome() {
  const { backend } = useAuth();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const done = () => router.replace((next as never) ?? '/');

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const demo = (role: Role) => run(async () => {
    await backend.demoSignIn!(role);
    done();
  });

  return (
    <Screen>
      <Hero
        eyebrow="12U Youth Baseball · Cooperstown, NY"
        title="The Cooperstown Experience"
        subtitle="Everything your family and team need for the week of a lifetime — in one app.">
        <Stack gap={S.sm} style={{ marginTop: S.md }}>
          {FEATURES.map((f) => (
            <Row key={f.text}>
              <Icon name={f.icon} size={18} color={C.gold} />
              <Body style={{ color: C.white }}>{f.text}</Body>
            </Row>
          ))}
        </Stack>
      </Hero>

      {backend.continueAsGuest && (
        <Card>
          <H2>Families & coaches</H2>
          <Body style={{ color: C.muted }}>See your team’s games, scores, standings and brackets. No account needed.</Body>
          <Button
            title="See the schedule"
            icon="calendar"
            loading={busy}
            onPress={() =>
              run(async () => {
                await backend.continueAsGuest!();
                router.replace((next as never) ?? '/fan');
              })
            }
          />
        </Card>
      )}

      {backend.signInWithPassword && <StaffSignIn onDone={done} />}

      {backend.sendSignInCode && (
      <Card>
        <H2>{step === 'email' ? 'Sign in' : 'Check your email'}</H2>
        {step === 'email' ? (
          <>
            <Body style={{ color: C.muted }}>
              Use the email your registration was made with. We’ll send you a 6-digit code — no password needed.
            </Body>
            <Field
              label="Email"
              placeholder="you@example.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              onSubmitEditing={() => email && run(async () => (await backend.sendSignInCode!(email.trim()), setStep('code')))}
            />
            <Button
              title="Send code"
              icon="mail"
              loading={busy}
              disabled={!/^\S+@\S+\.\S+$/.test(email.trim())}
              onPress={() => run(async () => (await backend.sendSignInCode!(email.trim()), setStep('code')))}
            />
          </>
        ) : (
          <>
            <Body style={{ color: C.muted }}>We sent a code to {email}.</Body>
            <Field
              label="6-digit code"
              placeholder="123456"
              keyboardType="number-pad"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChangeText={setCode}
            />
            <Button
              title="Sign in"
              loading={busy}
              disabled={code.length !== 6}
              onPress={() => run(async () => (await backend.verifySignInCode!(email.trim(), code), done()))}
            />
            <Button title="Use a different email" variant="ghost" small onPress={() => setStep('email')} />
          </>
        )}
        <ErrorNote message={error} />
      </Card>
      )}

      <Card onPress={() => router.push('/umpire' as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
        <Icon name="baseball" color={C.red} size={22} />
        <View style={{ flex: 1 }}>
          <Body style={{ fontWeight: '700' }}>Umpire? Enter scores</Body>
          <Caption>Use the week’s umpire code from the tournament director. No account needed.</Caption>
        </View>
        <Icon name="chevron-forward" color={C.muted} size={18} />
      </Card>

      {backend.demoSignIn && (
        <Card style={{ backgroundColor: C.goldSoft, borderColor: '#EAD9A0' }}>
          <Row>
            <Icon name="flask" color="#8A6A00" />
            <H2 style={{ fontSize: 18 }}>Demo mode</H2>
          </Row>
          <Caption>
            No backend is configured, so the app is running on sample data. Pick a role to explore, or sign in with any email and code
            123456 (director@demo.app signs in as the director).
          </Caption>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
            <Button title="Explore as a parent" icon="people" variant="dark" onPress={() => demo('fan')} style={{ flexGrow: 1 }} />
            <Button title="Explore as a director" icon="clipboard" variant="secondary" onPress={() => demo('director')} style={{ flexGrow: 1 }} />
          </View>
        </Card>
      )}
    </Screen>
  );
}

/** Tournament staff: the same email and password as the Cooperstown admin site. */
function StaffSignIn({ onDone }: { onDone: () => void }) {
  const { backend } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await backend.signInWithPassword!(email, password);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <H2>Tournament staff</H2>
      <Body style={{ color: C.muted }}>Directors sign in with their Cooperstown admin email and password.</Body>
      <Field label="Email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <Field label="Password" secureTextEntry autoComplete="password" value={password} onChangeText={setPassword} onSubmitEditing={submit} />
      <Button title="Sign in" icon="log-in" variant="dark" loading={busy} disabled={!email.trim() || !password} onPress={submit} />
      <ErrorNote message={error} />
    </Card>
  );
}

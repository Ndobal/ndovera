type FlutterwaveCheckoutResponse = {
  status?: string;
  message?: string;
  data?: {
    link?: string;
  };
};

function getFlutterwaveSecretKey() {
  return (
    process.env.FLUTTERWAVE_SECRET_KEY?.trim()
    || process.env.FLW_SECRET_KEY?.trim()
    || process.env.NDOVERA_FLUTTERWAVE_SECRET_KEY?.trim()
    || ''
  );
}

function getPublicBaseUrl() {
  return (
    process.env.NDOVERA_PUBLIC_URL?.trim()
    || process.env.PUBLIC_APP_URL?.trim()
    || process.env.APP_URL?.trim()
    || 'https://ndovera.com'
  ).replace(/\/$/, '');
}

export function flutterwaveEnabled() {
  return Boolean(getFlutterwaveSecretKey());
}

export async function createFlutterwaveCheckout(input: {
  txRef: string;
  amountNaira: number;
  customerName: string;
  customerEmail: string;
  schoolName: string;
  waitToken: string;
}) {
  const secretKey = getFlutterwaveSecretKey();
  if (!secretKey) {
    throw new Error('Flutterwave is not configured.');
  }
  const redirectUrl = `${getPublicBaseUrl()}/onboarding-payment-complete?waitToken=${encodeURIComponent(input.waitToken)}`;
  const response = await fetch('https://api.flutterwave.com/v3/payments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tx_ref: input.txRef,
      amount: Math.max(0, Number(input.amountNaira || 0)),
      currency: 'NGN',
      redirect_url: redirectUrl,
      payment_options: 'card,banktransfer,ussd',
      customer: {
        email: input.customerEmail,
        name: input.customerName,
      },
      customizations: {
        title: 'Ndovera school onboarding',
        description: `Onboarding payment for ${input.schoolName}`,
      },
      meta: {
        waitToken: input.waitToken,
        schoolName: input.schoolName,
      },
    }),
  });
  const payload = await response.json().catch(() => ({})) as FlutterwaveCheckoutResponse;
  if (!response.ok || payload.status !== 'success' || !payload.data?.link) {
    throw new Error(payload.message || 'Unable to start Flutterwave checkout.');
  }
  return payload.data.link;
}

export async function verifyFlutterwaveTransaction(transactionId: string) {
  const secretKey = getFlutterwaveSecretKey();
  if (!secretKey) {
    throw new Error('Flutterwave is not configured.');
  }
  const response = await fetch(`https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transactionId)}/verify`, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
  });
  const payload = await response.json().catch(() => ({})) as any;
  if (!response.ok || payload?.status !== 'success') {
    throw new Error(payload?.message || 'Unable to verify Flutterwave payment.');
  }
  return payload?.data || null;
}

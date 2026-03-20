import React, { useEffect, useMemo, useState } from 'react';
import {
  CreditCard,
  Download,
  Filter,
  HandCoins,
  Package,
  Plus,
  Receipt,
  Search,
  ShoppingBag,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Role } from '../types';
import { useData } from '../hooks/useData';
import { fetchWithAuth } from '../services/apiClient';
import { tuckshopTransactions } from '../features/student/data/studentPortalFixtures';

type ManagerTab = 'sales' | 'inventory' | 'debtors' | 'reports' | 'audit';
type UserTab = 'account' | 'history' | 'payments' | 'preorder';

type DashboardCard = { label: string; value: string; tone?: string };
type ProductItem = { id: string; name: string; category: string; imageUrl?: string; price: string; stock: string; status: string; isBlocked?: boolean; blockReason?: string };
type DebtorItem = { id: string; userId?: string; name: string; type: string; balance: string; plan: string; status: string };
type ReportItem = { label: string; value: string; note: string };
type TransactionItem = { id: string; item: string; quantity: number; date: string; amount: string; method: string; child: string };
type PeriodTotal = { period: string; total: string };
type LedgerItem = { sn: number; date: string; description: string; amount: string };
type PaymentAccount = { id: string; method: string; accountName: string; accountNumber: string; bankName: string; auraWalletId: string; instructions: string };
type BuyerOption = { id: string; name: string; role: string };
type InstallmentOption = { id: string; label: string; paymentStatus: string; totalAmount: string; amountDue: string };
type ChildItem = { id: string; name: string };
type PurchaseBlock = { studentUserId: string; productId: string; productName: string; reason: string };
type OrderItem = { id: string; date: string; item: string; quantity: number; amount: string; paymentMethod: string; status: string; target: string; note: string };
type CartItem = { productId: string; quantity: number };
type DebtorDetail = {
  debtor: { id: string; userId: string; name: string; role: string; outstandingBalance: string; repaymentPlan: string; status: string };
  sales: Array<{ id: string; item: string; quantity: number; total: string; paid: string; due: string; method: string; status: string; date: string; note: string }>;
  installments: Array<{ id: string; saleId: string; item: string; amount: string; note: string; date: string }>;
};
type TuckshopDashboard = {
  roleState?: { role?: string; isManager?: boolean; isOversight?: boolean; isParent?: boolean; isStudent?: boolean; isStaff?: boolean };
  accountCards?: DashboardCard[];
  paymentInstructions?: string[];
  balances?: { walletBalanceNaira?: number; creditBalanceNaira?: number; spendingLimitNaira?: number };
  debtOverview?: { ownOweNaira?: number; othersOweNaira?: number };
  transactions?: TransactionItem[];
  transactionLedger?: LedgerItem[];
  periodTotals?: { daily?: PeriodTotal[]; weekly?: PeriodTotal[]; monthly?: PeriodTotal[] };
  products?: ProductItem[];
  paymentAccounts?: PaymentAccount[];
  buyerOptions?: BuyerOption[];
  installmentOptions?: InstallmentOption[];
  children?: ChildItem[];
  purchaseBlocks?: PurchaseBlock[];
  orders?: OrderItem[];
  debtors?: DebtorItem[];
  reports?: ReportItem[];
  auditLogs?: string[];
};

const PRODUCTS: ProductItem[] = [
  { id: 'ITM-001', name: 'Bottled Water', category: 'Drinks', price: '₦200', stock: '150 Units', status: 'In Stock' },
  { id: 'ITM-002', name: 'Fruit Juice', category: 'Drinks', price: '₦500', stock: '12 Units', status: 'Low Stock' },
  { id: 'ITM-003', name: 'Snack Pack', category: 'Food', price: '₦350', stock: '85 Units', status: 'In Stock' },
  { id: 'ITM-004', name: 'Exercise Book', category: 'Stationery', price: '₦700', stock: '44 Units', status: 'In Stock' },
];

const DEBTORS: DebtorItem[] = [
  { id: 'DB-01', userId: 's1', name: 'Precious Johnson', type: 'Student', balance: '₦3,200', plan: '₦1,000 weekly', status: 'Active' },
  { id: 'DB-02', userId: 't3', name: 'Mr. Samuel Okoro', type: 'Staff', balance: '₦5,500', plan: 'Payroll deduction pending', status: 'Pending' },
  { id: 'DB-03', userId: 's2', name: 'Daniel Musa', type: 'Student', balance: '₦1,200', plan: 'Paid partially', status: 'Part-paid' },
];

const REPORTS = [
  { label: 'Daily sales', value: '₦42,500', note: 'All paid sales captured today.' },
  { label: 'Credit exposure', value: '₦18,700', note: 'Open student and staff balances.' },
  { label: 'Top products', value: 'Drinks + Snacks', note: 'Highest movement this week.' },
  { label: 'Consumption split', value: '68% / 32%', note: 'Students vs staff purchases.' },
];

const AUDIT_LOGS = [
  'Sale TS-1024 was marked part-paid by Tuckshop Manager at 09:12 AM.',
  'Installment updated for Precious Johnson with ₦1,000 received.',
  'Fruit Juice stock reduced after synced offline sale batch.',
];

const getCardVisual = (label: string, tone?: string) => {
  const normalized = `${tone || ''} ${label}`.toLowerCase();
  if (normalized.includes('credit') || normalized.includes('debt')) {
    return { icon: <HandCoins size={16} />, color: 'text-orange-500', bg: 'bg-orange-500/10' };
  }
  if (normalized.includes('wallet') || normalized.includes('balance')) {
    return { icon: <Wallet size={16} />, color: 'text-purple-500', bg: 'bg-purple-500/10' };
  }
  if (normalized.includes('receipt') || normalized.includes('payment')) {
    return { icon: <Receipt size={16} />, color: 'text-orange-500', bg: 'bg-orange-500/10' };
  }
  if (normalized.includes('log') || normalized.includes('audit')) {
    return { icon: <ShieldCheck size={16} />, color: 'text-blue-500', bg: 'bg-blue-500/10' };
  }
  if (normalized.includes('limit') || normalized.includes('payroll')) {
    return { icon: <CreditCard size={16} />, color: 'text-emerald-500', bg: 'bg-emerald-500/10' };
  }
  return { icon: <TrendingUp size={16} />, color: 'text-emerald-500', bg: 'bg-emerald-500/10' };
};

const fieldClass = 'w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 shadow-[0_8px_24px_rgba(15,23,42,0.12)] outline-none transition-all focus:border-emerald-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:shadow-none';
const textareaClass = 'min-h-24 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 shadow-[0_8px_24px_rgba(15,23,42,0.12)] outline-none transition-all focus:border-emerald-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:shadow-none';
const elevatedCardClass = 'rounded-3xl border border-zinc-300/80 bg-white/95 shadow-[0_16px_40px_rgba(15,23,42,0.16)] dark:border-white/8 dark:bg-white/3 dark:shadow-none';

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read selected image.'));
    reader.readAsDataURL(file);
  });
}

export const TuckshopView = ({ role }: { role: Role }) => {
  const roleName = String(role || '');
  const { data, refetch } = useData<TuckshopDashboard>('/api/tuckshop/dashboard');
  const [selectedDebtorId, setSelectedDebtorId] = useState('');
  const { data: debtorDetail, loading: debtorDetailLoading } = useData<DebtorDetail>(`/api/tuckshop/debtors/${selectedDebtorId}`, { enabled: Boolean(selectedDebtorId) });
  const effectiveRole = String(data?.roleState?.role || roleName || '');
  const isOversight = data?.roleState?.isOversight ?? ['HoS', 'HOS', 'Owner', 'Ami'].includes(effectiveRole);
  const isParent = data?.roleState?.isParent ?? effectiveRole === 'Parent';
  const isStudent = data?.roleState?.isStudent ?? effectiveRole === 'Student';
  const isStaff = data?.roleState?.isStaff ?? ['Teacher', 'Class Teacher', 'HOD', 'Principal', 'Head Teacher', 'Nursery Head', 'Librarian', 'Accountant'].includes(effectiveRole);
  const isTuckshopManager = data?.roleState?.isManager ?? effectiveRole === 'Tuckshop Manager';

  const [managerTab, setManagerTab] = useState<ManagerTab>('sales');
  const [userTab, setUserTab] = useState<UserTab>(isParent ? 'history' : 'account');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [orderSuccessToast, setOrderSuccessToast] = useState<string | null>(null);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [blockReason, setBlockReason] = useState('Blocked by parent instruction.');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedPayOrder, setSelectedPayOrder] = useState<OrderItem | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [saleForm, setSaleForm] = useState({
    buyerUserId: '',
    productId: '',
    quantity: 1,
    unitPriceNaira: '',
    amountPaidNow: '',
    settlement: 'Paid in full',
    paymentSource: 'Wallet',
    note: '',
  });
  const [installmentForm, setInstallmentForm] = useState({
    saleId: '',
    amountPaidNow: '',
    note: '',
  });
  const [paymentAccountForm, setPaymentAccountForm] = useState({
    method: 'Bank Transfer',
    accountName: '',
    accountNumber: '',
    bankName: '',
    auraWalletId: '',
    instructions: '',
  });
  const [productEditorForm, setProductEditorForm] = useState({
    productId: '',
    priceNaira: '',
    imageUrl: '',
    stockQuantity: '',
  });
  const [customProductForm, setCustomProductForm] = useState({
    name: '',
    category: 'General',
    priceNaira: '',
    stockQuantity: '',
    imageUrl: '',
  });

  useEffect(() => {
    if (!selectedChildId && data?.children?.length) {
      setSelectedChildId(data.children[0].id);
    }
  }, [data?.children, selectedChildId]);

  useEffect(() => {
    if (!orderSuccessToast) return undefined;
    const timer = window.setTimeout(() => setOrderSuccessToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [orderSuccessToast]);

  useEffect(() => {
    if (!saleForm.buyerUserId && data?.buyerOptions?.length) {
      setSaleForm((current) => ({ ...current, buyerUserId: data.buyerOptions?.[0]?.id || '' }));
    }
  }, [data?.buyerOptions, saleForm.buyerUserId]);

  useEffect(() => {
    if (!installmentForm.saleId && data?.installmentOptions?.length) {
      setInstallmentForm((current) => ({ ...current, saleId: data.installmentOptions?.[0]?.id || '' }));
    }
  }, [data?.installmentOptions, installmentForm.saleId]);

  const userTransactions = useMemo(() => {
    if (data?.transactions?.length) {
      return data.transactions;
    }

    if (isParent) {
      return [
        { id: 'PT-01', item: 'Fruit Juice', quantity: 1, date: '2026-03-14 10:25 AM', amount: '₦500', method: 'Parent Wallet', child: 'Precious Johnson' },
        { id: 'PT-02', item: 'Snack Pack', quantity: 2, date: '2026-03-13 01:10 PM', amount: '₦700', method: 'Credit', child: 'Precious Johnson' },
      ];
    }

    if (isStaff) {
      return [
        { id: 'ST-01', item: 'Lunch Combo', quantity: 1, date: '2026-03-14 12:30 PM', amount: '₦1,800', method: 'Credit', child: 'Staff purchase' },
        { id: 'ST-02', item: 'Bottled Water', quantity: 2, date: '2026-03-13 09:05 AM', amount: '₦400', method: 'Wallet', child: 'Staff purchase' },
      ];
    }

    return tuckshopTransactions.map((transaction) => ({
      id: transaction.id,
      item: transaction.item,
      quantity: transaction.quantity,
      date: transaction.date,
      amount: transaction.amount,
      method: transaction.method,
      child: 'Self',
    }));
  }, [data?.transactions, isParent, isStaff]);

  const accountCards = data?.accountCards?.length
    ? data.accountCards.map((card) => ({ ...card, ...getCardVisual(card.label, card.tone) }))
    : isTuckshopManager
    ? [
        { label: "Today's Sales", value: '₦42,500', icon: <TrendingUp size={16} />, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        { label: 'Credit Exposure', value: '₦18,700', icon: <HandCoins size={16} />, color: 'text-orange-500', bg: 'bg-orange-500/10' },
        { label: 'Wallet Float', value: '₦1.2M', icon: <Wallet size={16} />, color: 'text-purple-500', bg: 'bg-purple-500/10' },
        { label: 'Immutable Logs', value: 'Active', icon: <ShieldCheck size={16} />, color: 'text-blue-500', bg: 'bg-blue-500/10' },
      ]
    : isParent
      ? [
          { label: 'Child Balance', value: '₦3,200', icon: <Wallet size={16} />, color: 'text-purple-500', bg: 'bg-purple-500/10' },
          { label: 'Spending Limit', value: '₦2,500/day', icon: <CreditCard size={16} />, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Recent Purchases', value: '2', icon: <ShoppingBag size={16} />, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: 'Receipts', value: 'Auto-issued', icon: <Receipt size={16} />, color: 'text-orange-500', bg: 'bg-orange-500/10' },
        ]
      : isStaff
        ? [
            { label: 'Outstanding Balance', value: '₦5,500', icon: <Wallet size={16} />, color: 'text-purple-500', bg: 'bg-purple-500/10' },
            { label: 'Credit Status', value: 'Active', icon: <HandCoins size={16} />, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
            { label: 'This Week', value: '₦2,200', icon: <TrendingUp size={16} />, color: 'text-blue-500', bg: 'bg-blue-500/10' },
            { label: 'Payroll Link', value: 'Optional', icon: <CreditCard size={16} />, color: 'text-orange-500', bg: 'bg-orange-500/10' },
          ]
        : [
            { label: 'Wallet Balance', value: '₦8,450', icon: <Wallet size={16} />, color: 'text-purple-500', bg: 'bg-purple-500/10' },
            { label: 'This Week', value: '₦1,250', icon: <TrendingUp size={16} />, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
            { label: 'Transactions', value: String(userTransactions.length), icon: <ShoppingBag size={16} />, color: 'text-blue-500', bg: 'bg-blue-500/10' },
            { label: 'Payment Mode', value: 'Cashless', icon: <CreditCard size={16} />, color: 'text-orange-500', bg: 'bg-orange-500/10' },
          ];

  const products: ProductItem[] = data?.products?.length ? data.products : PRODUCTS;
  const paymentAccounts = data?.paymentAccounts || [];
  const buyerOptions = data?.buyerOptions || [];
  const installmentOptions = data?.installmentOptions || [];
  const children = data?.children || [];
  const orders = data?.orders || [];
  const purchaseBlocks = data?.purchaseBlocks || [];
  const pendingPaymentOrders = orders.filter((order) => ['Pending payment', 'Payment sent'].includes(order.status));
  const awaitingSupplyOrders = orders.filter((order) => order.status === 'Awaiting supply');
  const paymentSentOrders = orders.filter((order) => order.status === 'Payment sent');
  const orderHistory = [...orders].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const transactionLedger = data?.transactionLedger?.length
    ? data.transactionLedger
    : userTransactions.map((transaction, index) => ({
        sn: index + 1,
        date: transaction.date,
        description: `${transaction.item} x${transaction.quantity}`,
        amount: transaction.amount,
      }));
  const periodTotals = data?.periodTotals || { daily: [], weekly: [], monthly: [] };
  const debtors = data?.debtors?.length ? data.debtors : DEBTORS;
  const reports = data?.reports?.length ? data.reports : REPORTS;
  const auditLogs = data?.auditLogs?.length ? data.auditLogs : AUDIT_LOGS;
  const paymentInstructions = data?.paymentInstructions?.length
    ? data.paymentInstructions
    : [
        'Use the student wallet or approved parent funding flow for tuck shop payments.',
        'Receipts are issued automatically when sales are marked paid.',
        'Tuck shop records remain separate from school fees.',
      ];
  const parentBalance = `₦${Number(data?.balances?.creditBalanceNaira ?? 3200).toLocaleString()}`;
  const parentLimit = `₦${Number(data?.balances?.spendingLimitNaira ?? 2500).toLocaleString()}/day`;
  const staffBalance = `₦${Number(data?.balances?.creditBalanceNaira ?? 5500).toLocaleString()}`;
  const oversightOwnOwe = `₦${Number(data?.debtOverview?.ownOweNaira ?? 0).toLocaleString()}`;
  const oversightOthersOwe = `₦${Number(data?.debtOverview?.othersOweNaira ?? 0).toLocaleString()}`;
  const selectedSaleProduct = products.find((product) => product.id === saleForm.productId) || null;
  const selectedBuyer = buyerOptions.find((buyer) => buyer.id === saleForm.buyerUserId) || null;
  const selectedInstallment = installmentOptions.find((sale) => sale.id === installmentForm.saleId) || null;
  const cartDetails = cartItems.map((cartItem) => {
    const product = products.find((entry) => entry.id === cartItem.productId);
    const unitPrice = Number(String(product?.price || '').replace(/[^\d.]/g, '')) || 0;
    return {
      ...cartItem,
      product,
      total: unitPrice * cartItem.quantity,
    };
  }).filter((entry) => entry.product);
  const cartTotal = cartDetails.reduce((sum, item) => sum + item.total, 0);
  const catalogUnitPrice = Number(String(selectedSaleProduct?.price || '').replace(/[^\d.]/g, '')) || 0;
  const resolvedUnitPrice = Math.max(0, Number(saleForm.unitPriceNaira || catalogUnitPrice || 0));
  const estimatedTotal = resolvedUnitPrice * Number(saleForm.quantity || 1);
  const resolvedAmountPaid = saleForm.settlement === 'Paid in full'
    ? estimatedTotal
    : saleForm.settlement === 'On credit'
      ? 0
      : Math.max(0, Number(saleForm.amountPaidNow || 0));
  const estimatedBalance = Math.max(0, estimatedTotal - resolvedAmountPaid);

  useEffect(() => {
    if (!selectedPaymentMethod && paymentAccounts.length) {
      setSelectedPaymentMethod(paymentAccounts[0].method);
    }
  }, [paymentAccounts, selectedPaymentMethod]);

  useEffect(() => {
    if (!productEditorForm.productId && products.length) {
      const first = products[0];
      setProductEditorForm({
        productId: first.id,
        priceNaira: String(Number(String(first.price).replace(/[^\d.]/g, '')) || 0),
        imageUrl: first.imageUrl || '',
        stockQuantity: String(Number(String(first.stock).replace(/[^\d.]/g, '')) || 0),
      });
    }
  }, [productEditorForm.productId, products]);

  useEffect(() => {
    if (!saleForm.productId && products.length) {
      const first = products[0];
      setSaleForm((current) => ({
        ...current,
        productId: first.id,
        unitPriceNaira: String(Number(String(first.price).replace(/[^\d.]/g, '')) || 0),
      }));
    }
  }, [products, saleForm.productId]);

  const postJson = async (url: string, payload: Record<string, unknown>) => {
    return fetchWithAuth(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  };

  const handleAddToCart = (product: ProductItem) => {
    setCartItems((current) => {
      const existing = current.find((item) => item.productId === product.id);
      if (existing) {
        return current.map((item) => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...current, { productId: product.id, quantity: 1 }];
    });
    setStatusMessage(`${product.name} added to cart.`);
  };

  const handleUpdateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCartItems((current) => current.filter((item) => item.productId !== productId));
      return;
    }
    setCartItems((current) => current.map((item) => item.productId === productId ? { ...item, quantity } : item));
  };

  const handlePlaceCartOrder = async () => {
    if (!cartDetails.length) {
      setStatusMessage('Add items to cart before placing an order.');
      return;
    }

    try {
      for (const item of cartDetails) {
        const payload: Record<string, unknown> = {
          productId: item.productId,
          quantity: item.quantity,
          paymentMethod: 'Pending selection',
          note: 'Cart order created from tuckshop gallery.',
        };
        if (isParent && selectedChildId) payload.studentUserId = selectedChildId;
        await postJson('/api/tuckshop/orders', payload);
      }
      setCartItems([]);
      setStatusMessage('Cart order placed successfully. Await manager supply confirmation.');
      setOrderSuccessToast('Order placed successfully. The manager has been notified.');
      await refetch();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to place cart order.');
    }
  };

  const handleToggleBlock = async (product: ProductItem) => {
    if (!selectedChildId) {
      setStatusMessage('Select a child before blocking or unblocking items.');
      return;
    }
    try {
      await postJson('/api/tuckshop/purchase-blocks', {
        studentUserId: selectedChildId,
        productId: product.id,
        blocked: !product.isBlocked,
        reason: blockReason,
      });
      setStatusMessage(`${product.name} ${product.isBlocked ? 'unblocked' : 'blocked'} successfully.`);
      await refetch();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to update purchase block.');
    }
  };

  const handleSavePaymentAccount = async () => {
    try {
      await postJson('/api/tuckshop/payment-accounts', paymentAccountForm);
      setStatusMessage(`${paymentAccountForm.method} account details saved.`);
      await refetch();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to save account details.');
    }
  };

  const handleAcknowledgePayment = async () => {
    if (!selectedPayOrder) {
      setStatusMessage('Choose a pending payment order first.');
      return;
    }
    try {
      await postJson('/api/tuckshop/payments/acknowledge', { method: selectedPaymentMethod || paymentAccounts[0]?.method || 'Bank Transfer', orderId: selectedPayOrder.id });
      setStatusMessage(`Payment acknowledgement sent for ${selectedPayOrder.item}.`);
      setSelectedPayOrder(null);
      await refetch();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to acknowledge payment.');
    }
  };

  const handleMarkSupplied = async (orderId: string) => {
    try {
      await postJson(`/api/tuckshop/orders/${orderId}/status`, { status: 'Pending payment' });
      setStatusMessage('Order marked as supplied and moved to pending payment.');
      await refetch();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to update order status.');
    }
  };

  const handleSaveProductDetails = async () => {
    if (!productEditorForm.productId) {
      setStatusMessage('Select a product to update.');
      return;
    }
    try {
      await postJson(`/api/tuckshop/products/${productEditorForm.productId}`, {
        priceNaira: Number(productEditorForm.priceNaira || 0),
        imageUrl: productEditorForm.imageUrl,
        stockQuantity: Number(productEditorForm.stockQuantity || 0),
      });
      setStatusMessage('Product price and picture details saved.');
      await refetch();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to save product details.');
    }
  };

  const handleProductImageUpload = async (file: File | undefined, mode: 'existing' | 'custom') => {
    if (!file) return;
    try {
      const imageUrl = await readFileAsDataUrl(file);
      if (mode === 'existing') {
        setProductEditorForm((current) => ({ ...current, imageUrl }));
      } else {
        setCustomProductForm((current) => ({ ...current, imageUrl }));
      }
      setStatusMessage('Image selected successfully. Save to publish it.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to read the selected image.');
    }
  };

  const handleCreateCustomProduct = async () => {
    if (!customProductForm.name.trim()) {
      setStatusMessage('Enter a product name before creating a custom product.');
      return;
    }

    try {
      await postJson('/api/tuckshop/products', {
        name: customProductForm.name.trim(),
        category: customProductForm.category,
        priceNaira: Number(customProductForm.priceNaira || 0),
        stockQuantity: Number(customProductForm.stockQuantity || 0),
        imageUrl: customProductForm.imageUrl,
      });
      setStatusMessage(`${customProductForm.name.trim()} created and published to users.`);
      setCustomProductForm({
        name: '',
        category: 'General',
        priceNaira: '',
        stockQuantity: '',
        imageUrl: '',
      });
      await refetch();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to create custom product.');
    }
  };

  const handleMarkOrderPaid = async (orderId: string) => {
    try {
      await postJson(`/api/tuckshop/orders/${orderId}/status`, { status: 'Paid' });
      setStatusMessage('Order marked as fully paid.');
      await refetch();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to mark order as paid.');
    }
  };

  const handleSaveSale = async () => {
    if (!saleForm.buyerUserId || !saleForm.productId) {
      setStatusMessage('Select a buyer and product before saving the sale.');
      return;
    }
    if (saleForm.settlement === 'Part-paid' && (!saleForm.amountPaidNow || Number(saleForm.amountPaidNow) <= 0)) {
      setStatusMessage('Enter the amount paid now for a part-paid sale.');
      return;
    }

    try {
      await postJson('/api/tuckshop/sales', {
        buyerUserId: saleForm.buyerUserId,
        productId: saleForm.productId,
        quantity: Number(saleForm.quantity || 1),
        unitPriceNaira: resolvedUnitPrice,
        amountPaidNaira: resolvedAmountPaid,
        paymentSource: saleForm.paymentSource,
        note: saleForm.note || `${saleForm.settlement} sale recorded from manager dashboard.`,
      });
      setStatusMessage(`Sale saved for ${selectedBuyer?.name || 'selected buyer'} successfully.`);
      setSaleForm((current) => ({
        ...current,
        quantity: 1,
        unitPriceNaira: String(Number(String(selectedSaleProduct?.price || '').replace(/[^\d.]/g, '')) || 0),
        amountPaidNow: '',
        settlement: 'Paid in full',
        paymentSource: 'Wallet',
        note: '',
      }));
      await refetch();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to save sale.');
    }
  };

  const handleSaveInstallment = async () => {
    if (!installmentForm.saleId) {
      setStatusMessage('Select a debt sale before recording an installment.');
      return;
    }
    const amount = Math.max(0, Number(installmentForm.amountPaidNow || 0));
    if (amount <= 0) {
      setStatusMessage('Enter a valid installment amount.');
      return;
    }

    try {
      await postJson('/api/tuckshop/installments', {
        saleId: installmentForm.saleId,
        amountPaidNaira: amount,
        note: installmentForm.note || 'Installment recorded from manager dashboard.',
      });
      setStatusMessage(`Installment saved for ${selectedInstallment?.label || 'selected debt'} successfully.`);
      setInstallmentForm((current) => ({
        ...current,
        amountPaidNow: '',
        note: '',
      }));
      await refetch();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to save installment.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Tuck Shop</h2>
          <p className="text-xs text-zinc-500">
            {isTuckshopManager
              ? 'Manager-only control for products, sales, payments, installments, debtors, reports, and audit trails.'
              : isOversight
                ? 'See what you owe, what others owe, and place orders without managing payment accounts.'
              : isParent
                ? 'See your child’s purchases, balance, receipts, and pre-order items without deleting or reversing transactions.'
                : isStaff
                  ? 'Buy on credit, view your balance, and monitor staff tuck shop spending.'
                  : 'View your account, payment instructions, and full tuck shop transaction history.'}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/5 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400 transition-all hover:bg-white/10">
            <Download size={14} /> {isTuckshopManager ? 'Sales Report' : 'Receipt History'}
          </button>
          {isTuckshopManager ? (
            <button className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg shadow-emerald-900/20">
              <Plus size={14} /> Record Sale
            </button>
          ) : null}
        </div>
      </div>

      <div className="rounded-3xl border border-white/8 bg-white/3 p-4 text-sm text-zinc-300">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Global visibility</p>
            <p className="mt-1">Users browse gallery items, place cart orders, wait for supply, then pay from the pending payment tab.</p>
          </div>
          <button
            onClick={() => setUserTab('payments')}
            className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300"
          >
            View payment guide
          </button>
        </div>
      </div>

      {statusMessage ? <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200">{statusMessage}</div> : null}

      {orderSuccessToast ? (
        <div className="pointer-events-none fixed right-4 top-4 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="flex min-w-70 items-start gap-3 rounded-3xl border border-emerald-400/30 bg-zinc-950/95 px-4 py-4 shadow-2xl backdrop-blur-xl">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
              <ShoppingBag size={18} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">Order confirmed</p>
              <p className="mt-1 text-sm text-white">{orderSuccessToast}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {accountCards.map((stat) => (
          <div key={stat.label} className="card-mini flex items-center gap-3">
            <div className={`w-8 h-8 ${stat.bg} ${stat.color} rounded-lg flex items-center justify-center`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">{stat.label}</p>
              <p className="text-base font-mono font-bold text-white">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {isTuckshopManager ? (
        <>
          <div className="flex items-center gap-6 border-b border-white/5">
            {[
              { id: 'sales', label: 'Sales' },
              { id: 'inventory', label: 'Inventory' },
              { id: 'debtors', label: 'Debtors' },
              { id: 'reports', label: 'Reports' },
              { id: 'audit', label: 'Audit' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setManagerTab(tab.id as ManagerTab)}
                className={`relative pb-3 text-[10px] font-bold uppercase tracking-widest transition-all ${managerTab === tab.id ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                {tab.label}
                {managerTab === tab.id ? <div className="absolute bottom-0 left-0 w-full h-0.5 rounded-full bg-emerald-500"></div> : null}
              </button>
            ))}
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
            {managerTab === 'sales' ? (
              <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <div className={`card-compact ${elevatedCardClass}`}>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Record and assign sales</h3>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="space-y-2 md:col-span-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Buyer to bill</span>
                      <select value={saleForm.buyerUserId} onChange={(event) => setSaleForm((current) => ({ ...current, buyerUserId: event.target.value }))} className={fieldClass}>
                        {buyerOptions.map((buyer) => <option key={buyer.id} value={buyer.id}>{buyer.name} • {buyer.role}</option>)}
                      </select>
                    </label>
                    <label className="space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Commodity</span>
                      <select value={saleForm.productId} onChange={(event) => {
                        const product = products.find((entry) => entry.id === event.target.value);
                        setSaleForm((current) => ({
                          ...current,
                          productId: event.target.value,
                          unitPriceNaira: String(Number(String(product?.price || '').replace(/[^\d.]/g, '')) || 0),
                        }));
                      }} className={fieldClass}>
                        {products.map((product) => <option key={product.id} value={product.id}>{product.name} • {product.id}</option>)}
                      </select>
                    </label>
                    <label className="space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Unit price ₦</span>
                      <input value={saleForm.unitPriceNaira} min={0} type="number" onChange={(event) => setSaleForm((current) => ({ ...current, unitPriceNaira: event.target.value }))} className={fieldClass} placeholder="Manager-set price" />
                    </label>
                    <label className="space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Quantity</span>
                      <input value={saleForm.quantity} min={1} type="number" onChange={(event) => setSaleForm((current) => ({ ...current, quantity: Math.max(1, Number(event.target.value || 1)) }))} className={fieldClass} placeholder="Quantity" />
                    </label>
                    <label className="space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Settlement</span>
                      <select value={saleForm.settlement} onChange={(event) => setSaleForm((current) => ({ ...current, settlement: event.target.value }))} className={fieldClass}>
                        <option>Paid in full</option>
                        <option>Part-paid</option>
                        <option>On credit</option>
                      </select>
                    </label>
                    <label className="space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Amount paid now ₦</span>
                      <input value={saleForm.amountPaidNow} onChange={(event) => setSaleForm((current) => ({ ...current, amountPaidNow: event.target.value }))} disabled={saleForm.settlement !== 'Part-paid'} className={`${fieldClass} disabled:opacity-50`} placeholder="Amount paid now" />
                    </label>
                    <label className="space-y-2 md:col-span-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Payment source</span>
                      <select value={saleForm.paymentSource} onChange={(event) => setSaleForm((current) => ({ ...current, paymentSource: event.target.value }))} className={fieldClass}>
                        <option>Wallet</option>
                        <option>Auras</option>
                        <option>Bank Transfer</option>
                        <option>Credit</option>
                        <option>Parent Wallet</option>
                      </select>
                    </label>
                    <textarea value={saleForm.note} onChange={(event) => setSaleForm((current) => ({ ...current, note: event.target.value }))} className={`md:col-span-2 ${textareaClass}`} placeholder="Optional sale note" />
                  </div>
                  <div className="mt-4 grid gap-3 rounded-2xl bg-white/4 p-4 text-sm text-zinc-300 md:grid-cols-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Buyer</p>
                      <p className="mt-1 text-white">{selectedBuyer ? `${selectedBuyer.name} • ${selectedBuyer.role}` : 'Select buyer'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Unit price used</p>
                      <p className="mt-1 font-mono text-white">₦{resolvedUnitPrice.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Estimated total</p>
                      <p className="mt-1 font-mono text-white">₦{estimatedTotal.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Balance after payment</p>
                      <p className="mt-1 font-mono text-white">₦{estimatedBalance.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button onClick={handleSaveSale} className="rounded-xl bg-emerald-600 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white">Save immutable sale</button>
                  </div>
                </div>
                <div className={`card-compact ${elevatedCardClass}`}>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Installments and payments</h3>
                  <div className="mt-4 space-y-3 text-sm text-zinc-300">
                    <div className="rounded-2xl bg-white/4 p-4">Support fully paid, partially paid, and credit sales.</div>
                    <div className="rounded-2xl bg-white/4 p-4">Balance auto-tracks after each payment marking.</div>
                    <div className="rounded-2xl bg-white/4 p-4">Edits and payment updates remain logged for audit.</div>
                    <div className="rounded-2xl bg-white/4 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Awaiting supply queue</p>
                      <div className="mt-3 space-y-2">
                        {awaitingSupplyOrders.length ? awaitingSupplyOrders.slice(0, 6).map((order) => (
                          <div key={order.id} className="rounded-xl bg-black/20 px-3 py-3 text-xs text-zinc-300">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-semibold text-white">{order.item} x{order.quantity}</p>
                                <p className="mt-1 text-zinc-500">{order.target} • {order.date}</p>
                              </div>
                              <button onClick={() => handleMarkSupplied(order.id)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white">Mark supplied</button>
                            </div>
                          </div>
                        )) : <div className="rounded-xl bg-black/20 px-3 py-3 text-xs text-zinc-400">No orders are waiting for supply.</div>}
                      </div>
                    </div>
                    <div className="grid gap-3 rounded-2xl bg-white/4 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Payment sent confirmation queue</p>
                      <div className="space-y-2">
                        {paymentSentOrders.length ? paymentSentOrders.slice(0, 6).map((order) => (
                          <div key={order.id} className="rounded-xl bg-black/20 px-3 py-3 text-xs text-zinc-300">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-semibold text-white">{order.item} x{order.quantity}</p>
                                <p className="mt-1 text-zinc-500">{order.target} • {order.amount} • {order.paymentMethod}</p>
                              </div>
                              <button onClick={() => handleMarkOrderPaid(order.id)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white">Mark paid</button>
                            </div>
                          </div>
                        )) : <div className="rounded-xl bg-black/20 px-3 py-3 text-xs text-zinc-400">No payment acknowledgements are waiting for confirmation.</div>}
                      </div>
                    </div>
                    <div className="grid gap-3 rounded-2xl bg-white/4 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Record installment on existing debt</p>
                      <select
                        value={installmentForm.saleId}
                        onChange={(event) => setInstallmentForm((current) => ({ ...current, saleId: event.target.value }))}
                        className={fieldClass}
                      >
                        {installmentOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                      </select>
                      <input
                        value={installmentForm.amountPaidNow}
                        onChange={(event) => setInstallmentForm((current) => ({ ...current, amountPaidNow: event.target.value }))}
                        className={fieldClass}
                        placeholder="Installment amount"
                      />
                      <textarea
                        value={installmentForm.note}
                        onChange={(event) => setInstallmentForm((current) => ({ ...current, note: event.target.value }))}
                        className={textareaClass}
                        placeholder="Optional installment note"
                      />
                      {selectedInstallment ? (
                        <div className="grid gap-3 rounded-2xl bg-black/20 p-3 md:grid-cols-2">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Outstanding sale</p>
                            <p className="mt-1 text-white">{selectedInstallment.label}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Amount due</p>
                            <p className="mt-1 font-mono text-white">{selectedInstallment.amountDue}</p>
                          </div>
                        </div>
                      ) : null}
                      <button onClick={handleSaveInstallment} className="rounded-xl bg-amber-500 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-black">Save installment update</button>
                    </div>
                    <div className="grid gap-3 rounded-2xl bg-white/4 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Manager payment account setup</p>
                      <select
                        value={paymentAccountForm.method}
                        onChange={(event) => setPaymentAccountForm((current) => ({ ...current, method: event.target.value }))}
                        className={fieldClass}
                      >
                        <option>Bank Transfer</option>
                        <option>Auras</option>
                      </select>
                      <input value={paymentAccountForm.accountName} onChange={(event) => setPaymentAccountForm((current) => ({ ...current, accountName: event.target.value }))} className={fieldClass} placeholder="Account / wallet name" />
                      <input value={paymentAccountForm.accountNumber} onChange={(event) => setPaymentAccountForm((current) => ({ ...current, accountNumber: event.target.value }))} className={fieldClass} placeholder="Account number" />
                      <input value={paymentAccountForm.bankName} onChange={(event) => setPaymentAccountForm((current) => ({ ...current, bankName: event.target.value }))} className={fieldClass} placeholder="Bank name" />
                      <input value={paymentAccountForm.auraWalletId} onChange={(event) => setPaymentAccountForm((current) => ({ ...current, auraWalletId: event.target.value }))} className={fieldClass} placeholder="Aura wallet ID" />
                      <textarea value={paymentAccountForm.instructions} onChange={(event) => setPaymentAccountForm((current) => ({ ...current, instructions: event.target.value }))} className={textareaClass} placeholder="Payment instructions shown to users" />
                      <button onClick={handleSavePaymentAccount} className="rounded-xl bg-emerald-600 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white">Save payment details</button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {managerTab === 'inventory' ? (
              <div className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                  <div className={`card-compact ${elevatedCardClass}`}>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Product picture and price editor</h3>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <select value={productEditorForm.productId} onChange={(event) => {
                        const product = products.find((entry) => entry.id === event.target.value);
                        setProductEditorForm({
                          productId: event.target.value,
                          priceNaira: String(Number(String(product?.price || '').replace(/[^\d.]/g, '')) || 0),
                          imageUrl: product?.imageUrl || '',
                          stockQuantity: String(Number(String(product?.stock || '').replace(/[^\d.]/g, '')) || 0),
                        });
                      }} className={fieldClass}>
                        {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                      </select>
                      <input value={productEditorForm.priceNaira} onChange={(event) => setProductEditorForm((current) => ({ ...current, priceNaira: event.target.value }))} className={fieldClass} placeholder="Price in naira" />
                      <input value={productEditorForm.stockQuantity} onChange={(event) => setProductEditorForm((current) => ({ ...current, stockQuantity: event.target.value }))} className={fieldClass} placeholder="Available stock" />
                      <label className="space-y-2 md:col-span-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Upload optional image</span>
                        <input type="file" accept="image/*" onChange={(event) => void handleProductImageUpload(event.target.files?.[0], 'existing')} className={fieldClass} />
                      </label>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button onClick={handleSaveProductDetails} className="rounded-xl bg-emerald-600 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white">Save product details</button>
                    </div>
                  </div>
                  <div className={`card-compact ${elevatedCardClass}`}>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Gallery preview</h3>
                    <div className="mt-4 rounded-3xl border border-white/8 bg-white/4 p-4">
                      <div className="aspect-4/3 overflow-hidden rounded-2xl bg-linear-to-br from-emerald-500/20 via-zinc-900 to-purple-500/10">
                        {productEditorForm.imageUrl ? <img src={productEditorForm.imageUrl} alt="Product preview" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Package className="text-zinc-500" size={40} /></div>}
                      </div>
                      <p className="mt-4 text-base font-semibold text-white">{products.find((entry) => entry.id === productEditorForm.productId)?.name || 'Select a product'}</p>
                      <p className="mt-1 text-sm font-mono text-emerald-300">₦{Number(productEditorForm.priceNaira || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
                <div className={`grid gap-4 lg:grid-cols-[1.05fr_0.95fr]`}>
                  <div className={`card-compact ${elevatedCardClass}`}>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Create custom product</h3>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <input value={customProductForm.name} onChange={(event) => setCustomProductForm((current) => ({ ...current, name: event.target.value }))} className={fieldClass} placeholder="Product name" />
                      <input value={customProductForm.category} onChange={(event) => setCustomProductForm((current) => ({ ...current, category: event.target.value }))} className={fieldClass} placeholder="Category" />
                      <input value={customProductForm.priceNaira} type="number" min={0} onChange={(event) => setCustomProductForm((current) => ({ ...current, priceNaira: event.target.value }))} className={fieldClass} placeholder="Price in naira" />
                      <input value={customProductForm.stockQuantity} type="number" min={0} onChange={(event) => setCustomProductForm((current) => ({ ...current, stockQuantity: event.target.value }))} className={fieldClass} placeholder="Opening stock" />
                      <label className="space-y-2 md:col-span-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Upload optional image</span>
                        <input type="file" accept="image/*" onChange={(event) => void handleProductImageUpload(event.target.files?.[0], 'custom')} className={fieldClass} />
                      </label>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button onClick={handleCreateCustomProduct} className="rounded-xl bg-emerald-600 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white">Create custom product</button>
                    </div>
                  </div>
                  <div className={`card-compact ${elevatedCardClass}`}>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">New product preview</h3>
                    <div className="mt-4 rounded-3xl border border-white/8 bg-white/4 p-4">
                      <div className="aspect-4/3 overflow-hidden rounded-2xl bg-linear-to-br from-emerald-500/20 via-zinc-900 to-purple-500/10">
                        {customProductForm.imageUrl ? <img src={customProductForm.imageUrl} alt="Custom product preview" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Package className="text-zinc-500" size={40} /></div>}
                      </div>
                      <p className="mt-4 text-base font-semibold text-white">{customProductForm.name || 'Custom product name'}</p>
                      <p className="mt-1 text-sm text-zinc-400">{customProductForm.category || 'General'}</p>
                      <p className="mt-2 text-sm font-mono text-emerald-300">₦{Number(customProductForm.priceNaira || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-4 md:flex-row">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                    <input className="w-full rounded-xl border border-white/5 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-emerald-500/50 transition-all" placeholder="Search products" />
                  </div>
                  <button className="rounded-xl border border-white/5 bg-white/5 p-2.5 text-zinc-400 hover:text-white transition-all"><Filter size={18} /></button>
                </div>
                <div className="card-compact p-0! overflow-hidden">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-white/2 text-[10px] font-bold uppercase tracking-wider text-zinc-500 border-b border-white/5">
                        <th className="px-6 py-4">Item</th>
                        <th className="px-6 py-4">Category</th>
                        <th className="px-6 py-4">Price</th>
                        <th className="px-6 py-4">Stock</th>
                        <th className="px-6 py-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {products.map((item) => (
                        <tr key={item.id} className="hover:bg-white/1 transition-colors">
                          <td className="px-6 py-4">
                            <p className="text-sm font-medium text-zinc-200">{item.name}</p>
                            <p className="text-[10px] text-zinc-500 font-mono">{item.id}</p>
                          </td>
                          <td className="px-6 py-4 text-xs text-zinc-400">{item.category}</td>
                          <td className="px-6 py-4 text-sm font-mono text-zinc-300">{item.price}</td>
                          <td className="px-6 py-4 text-xs text-zinc-500">{item.stock}</td>
                          <td className="px-6 py-4"><span className={`rounded px-2 py-0.5 text-[9px] font-bold uppercase ${item.status === 'In Stock' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{item.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {managerTab === 'debtors' ? (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  {debtors.map((debtor) => (
                    <div key={debtor.id} className="card-compact border border-white/5">
                      <p className="text-sm font-semibold text-white">{debtor.name}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-wider text-zinc-500">{debtor.type} • {debtor.id}</p>
                      <p className="mt-4 text-lg font-bold text-amber-300">{debtor.balance}</p>
                      <p className="mt-2 text-sm text-zinc-300">{debtor.plan}</p>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span className="inline-flex rounded-full bg-white/5 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-zinc-300">{debtor.status}</span>
                        <button onClick={() => setSelectedDebtorId(debtor.id)} className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-200">Open details</button>
                      </div>
                    </div>
                  ))}
                </div>

                {selectedDebtorId ? (
                  <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/60 backdrop-blur-sm">
                    <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-zinc-950 p-6 shadow-2xl">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Debtor detail</p>
                          <h3 className="mt-2 text-xl font-bold text-white">{debtorDetail?.debtor.name || 'Loading debtor...'}</h3>
                          <p className="mt-1 text-sm text-zinc-400">{debtorDetail?.debtor.role || 'Role pending'} • {debtorDetail?.debtor.outstandingBalance || '₦0'}</p>
                        </div>
                        <button onClick={() => setSelectedDebtorId('')} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-300">Close</button>
                      </div>

                      {debtorDetailLoading ? <div className="mt-6 rounded-2xl bg-white/4 p-4 text-sm text-zinc-300">Loading debtor details...</div> : null}

                      {debtorDetail ? (
                        <div className="mt-6 space-y-6">
                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
                              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Outstanding</p>
                              <p className="mt-2 text-lg font-bold text-amber-300">{debtorDetail.debtor.outstandingBalance}</p>
                            </div>
                            <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
                              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Repayment plan</p>
                              <p className="mt-2 text-sm text-white">{debtorDetail.debtor.repaymentPlan}</p>
                            </div>
                            <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
                              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Status</p>
                              <p className="mt-2 text-sm text-white">{debtorDetail.debtor.status}</p>
                            </div>
                          </div>

                          <div className="rounded-3xl border border-white/8 bg-white/3 p-4">
                            <h4 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Related sales</h4>
                            <div className="mt-4 space-y-3">
                              {debtorDetail.sales.length ? debtorDetail.sales.map((sale) => (
                                <div key={sale.id} className="rounded-2xl bg-white/4 p-4 text-sm text-zinc-300">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="font-semibold text-white">{sale.item} x{sale.quantity}</p>
                                    <span className="rounded-full bg-white/5 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-300">{sale.status}</span>
                                  </div>
                                  <div className="mt-3 grid gap-2 md:grid-cols-4">
                                    <div><p className="text-[10px] uppercase tracking-wider text-zinc-500">Total</p><p className="font-mono text-white">{sale.total}</p></div>
                                    <div><p className="text-[10px] uppercase tracking-wider text-zinc-500">Paid</p><p className="font-mono text-white">{sale.paid}</p></div>
                                    <div><p className="text-[10px] uppercase tracking-wider text-zinc-500">Due</p><p className="font-mono text-amber-300">{sale.due}</p></div>
                                    <div><p className="text-[10px] uppercase tracking-wider text-zinc-500">Method</p><p className="text-white">{sale.method}</p></div>
                                  </div>
                                  <p className="mt-3 text-xs text-zinc-500">{sale.date}</p>
                                  {sale.note ? <p className="mt-2 text-xs text-zinc-400">{sale.note}</p> : null}
                                </div>
                              )) : <div className="rounded-2xl bg-white/4 p-4 text-sm text-zinc-300">No outstanding sales for this debtor.</div>}
                            </div>
                          </div>

                          <div className="rounded-3xl border border-white/8 bg-white/3 p-4">
                            <h4 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Installment history</h4>
                            <div className="mt-4 space-y-3">
                              {debtorDetail.installments.length ? debtorDetail.installments.map((installment) => (
                                <div key={installment.id} className="rounded-2xl bg-white/4 p-4 text-sm text-zinc-300">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="font-semibold text-white">{installment.item}</p>
                                    <p className="font-mono text-emerald-300">{installment.amount}</p>
                                  </div>
                                  <p className="mt-2 text-xs text-zinc-500">Sale: {installment.saleId} • {installment.date}</p>
                                  {installment.note ? <p className="mt-2 text-xs text-zinc-400">{installment.note}</p> : null}
                                </div>
                              )) : <div className="rounded-2xl bg-white/4 p-4 text-sm text-zinc-300">No installment history for this debtor yet.</div>}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {managerTab === 'reports' ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {reports.map((report) => (
                  <div key={report.label} className="card-compact border border-white/5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{report.label}</p>
                    <p className="mt-3 text-lg font-bold text-white">{report.value}</p>
                    <p className="mt-2 text-sm text-zinc-400">{report.note}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {managerTab === 'audit' ? (
              <div className="grid gap-3">
                {auditLogs.map((log) => (
                  <div key={log} className="card-compact border border-white/5 text-sm text-zinc-300">{log}</div>
                ))}
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-6 border-b border-white/5">
            {[
              { id: 'account', label: 'Gallery' },
              { id: 'history', label: isParent ? 'Child history' : 'History' },
              { id: 'preorder', label: 'Pending payment' },
              { id: 'payments', label: 'Payments' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setUserTab(tab.id as UserTab)}
                className={`relative pb-3 text-[10px] font-bold uppercase tracking-widest transition-all ${userTab === tab.id ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                {tab.label}
                {userTab === tab.id ? <div className="absolute bottom-0 left-0 w-full h-0.5 rounded-full bg-emerald-500"></div> : null}
              </button>
            ))}
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
            {userTab === 'account' ? (
              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="card-compact">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Available stock gallery</h3>
                    {isParent ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <select value={selectedChildId} onChange={(event) => setSelectedChildId(event.target.value)} className={fieldClass}>
                          {children.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}
                        </select>
                        <input value={blockReason} onChange={(event) => setBlockReason(event.target.value)} className={fieldClass} placeholder="Reason for blocking item" />
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {products.map((product) => {
                      const activeBlock = purchaseBlocks.find((entry) => entry.productId === product.id && (!selectedChildId || entry.studentUserId === selectedChildId));
                      const blocked = Boolean(product.isBlocked || activeBlock);
                      return (
                        <div key={product.id} className="overflow-hidden rounded-3xl border border-white/8 bg-white/4">
                          <div className="aspect-4/3 overflow-hidden bg-linear-to-br from-emerald-500/20 via-zinc-900 to-purple-500/20">
                            {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Package size={40} className="text-zinc-500" /></div>}
                          </div>
                          <div className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-white">{product.name}</p>
                                <p className="text-[10px] uppercase tracking-wider text-zinc-500">{product.category} • {product.stock}</p>
                              </div>
                              <span className={`rounded px-2 py-1 text-[9px] font-bold uppercase ${blocked ? 'bg-red-500/10 text-red-300' : 'bg-emerald-500/10 text-emerald-300'}`}>{blocked ? 'Blocked' : product.status}</span>
                            </div>
                            <p className="mt-3 text-lg font-bold text-white">{product.price}</p>
                            {blocked ? <p className="mt-2 text-xs text-red-200">{activeBlock?.reason || product.blockReason || 'Blocked by parent or guardian.'}</p> : null}
                            <div className="mt-4 flex flex-wrap gap-2">
                              <button onClick={() => handleAddToCart(product)} disabled={blocked && isStudent} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50">Add to cart</button>
                              {isParent ? <button onClick={() => handleToggleBlock(product)} className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-200">{blocked ? 'Unblock' : 'Block item'}</button> : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="card-compact">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Cart</h3>
                  <div className="mt-4 space-y-3 text-sm text-zinc-300">
                    {cartDetails.length ? cartDetails.map((item) => (
                      <div key={item.productId} className="rounded-2xl bg-white/4 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-white">{item.product?.name}</p>
                            <p className="text-[10px] uppercase tracking-wider text-zinc-500">{item.product?.price} each</p>
                          </div>
                          <p className="font-mono text-white">₦{item.total.toLocaleString()}</p>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <button onClick={() => handleUpdateCartQuantity(item.productId, item.quantity - 1)} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white">-</button>
                          <span className="min-w-8 text-center text-white">{item.quantity}</span>
                          <button onClick={() => handleUpdateCartQuantity(item.productId, item.quantity + 1)} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white">+</button>
                        </div>
                      </div>
                    )) : <div className="rounded-2xl bg-white/4 p-4 text-sm text-zinc-300">No items in cart yet. Add products from the gallery.</div>}
                    <div className="rounded-2xl bg-black/20 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Cart total</span>
                        <span className="font-mono text-white">₦{cartTotal.toLocaleString()}</span>
                      </div>
                    </div>
                    <button onClick={handlePlaceCartOrder} className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white">Place order for all items</button>
                  </div>
                </div>
              </div>
            ) : null}

            {userTab === 'history' ? (
              <div className="space-y-4">
                <div className="card-compact p-0! overflow-hidden">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-white/2 text-[10px] font-bold uppercase tracking-wider text-zinc-500 border-b border-white/5">
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Order</th>
                        <th className="px-6 py-4">Qty</th>
                        <th className="px-6 py-4">Amount</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Payment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {orderHistory.map((order) => (
                        <tr key={order.id} className="hover:bg-white/2 transition-colors">
                          <td className="px-6 py-4 text-xs font-mono text-zinc-500">{order.date}</td>
                          <td className="px-6 py-4 text-sm text-zinc-200">{order.item}</td>
                          <td className="px-6 py-4 text-sm text-zinc-300">{order.quantity}</td>
                          <td className="px-6 py-4 text-sm font-mono text-white">{order.amount}</td>
                          <td className="px-6 py-4 text-xs text-zinc-300">{order.status}</td>
                          <td className="px-6 py-4 text-xs text-zinc-400">{order.paymentMethod}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {userTab === 'payments' ? (
              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="card-compact">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Approved payment methods</h3>
                  <div className="mt-4 space-y-3 text-sm text-zinc-300">
                    {paymentAccounts.map((account) => (
                      <div key={account.id} className="rounded-2xl bg-white/4 p-4">
                        <p className="text-sm font-semibold text-white">{account.method}</p>
                        {account.accountName ? <p className="mt-2">Account: {account.accountName}</p> : null}
                        {account.bankName ? <p className="mt-1">Bank: {account.bankName}</p> : null}
                        {account.accountNumber ? <p className="mt-1 font-mono text-white">Acct No: {account.accountNumber}</p> : null}
                        {account.auraWalletId ? <p className="mt-1 font-mono text-white">Aura ID: {account.auraWalletId}</p> : null}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="card-compact">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Simple guide</h3>
                  <div className="mt-4 space-y-3 text-sm text-zinc-300">
                    <div className="rounded-2xl bg-white/4 p-4">1. Add products to cart from the gallery and place your order.</div>
                    <div className="rounded-2xl bg-white/4 p-4">2. Wait for the manager to mark the order as supplied.</div>
                    <div className="rounded-2xl bg-white/4 p-4">3. Open Pending payment, click Pay now, review account details, then click I have paid.</div>
                  </div>
                </div>
              </div>
            ) : null}

            {userTab === 'preorder' ? (
              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="card-compact">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Pending payment orders</h3>
                  <div className="mt-4 space-y-4">
                    {pendingPaymentOrders.length ? pendingPaymentOrders.map((order) => (
                      <div key={order.id} className="rounded-2xl border border-white/8 bg-white/4 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">{order.item} x{order.quantity}</p>
                            <p className="text-[10px] uppercase tracking-wider text-zinc-500">{order.target} • {order.date}</p>
                          </div>
                          <span className="rounded px-2 py-1 text-[9px] font-bold uppercase bg-amber-500/10 text-amber-200">{order.status}</span>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <p className="font-mono text-white">{order.amount}</p>
                          <button onClick={() => { setSelectedPayOrder(order); setSelectedPaymentMethod(paymentAccounts[0]?.method || 'Bank Transfer'); }} className="rounded-xl bg-emerald-600 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white">Pay now</button>
                        </div>
                      </div>
                    )) : <div className="rounded-2xl bg-white/4 p-4 text-sm text-zinc-300">No orders are waiting for payment right now. Supplied orders will appear here.</div>}
                  </div>
                </div>
                <div className="card-compact">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Pending payment summary</h3>
                  <div className="mt-4 space-y-3 text-sm text-zinc-300">
                    <div className="rounded-2xl bg-white/4 p-4">Orders only move here after the manager supplies them.</div>
                    <div className="rounded-2xl bg-white/4 p-4">Use Pay now to view approved bank or Aura payment details in one popup.</div>
                    <div className="rounded-2xl bg-white/4 p-4">After transfer, click I have paid inside the popup so the manager can verify payment.</div>
                  </div>
                  <div className="mt-4 border-t border-white/5 pt-4">
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">All orders awaiting supply</h4>
                    <div className="mt-3 space-y-2">
                      {awaitingSupplyOrders.slice(0, 5).map((order) => (
                        <div key={order.id} className="rounded-xl bg-white/4 px-3 py-2 text-xs text-zinc-300">
                          <div className="flex items-center justify-between gap-3 text-white"><span>{order.item} x{order.quantity}</span><span>{order.amount}</span></div>
                          <div className="mt-1 flex items-center justify-between gap-3 text-zinc-500"><span>{order.target}</span><span>{order.status}</span></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </>
      )}

      {selectedPayOrder ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Pay now</p>
                <h3 className="mt-2 text-xl font-bold text-white">{selectedPayOrder.item} x{selectedPayOrder.quantity}</h3>
                <p className="mt-1 text-sm text-zinc-400">{selectedPayOrder.amount} • {selectedPayOrder.target} • {selectedPayOrder.date}</p>
              </div>
              <button onClick={() => setSelectedPayOrder(null)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-300">Close</button>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {paymentAccounts.map((account) => (
                <button
                  key={account.id}
                  onClick={() => setSelectedPaymentMethod(account.method)}
                  className={`rounded-2xl border p-4 text-left transition-all ${selectedPaymentMethod === account.method ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-white/8 bg-white/4'}`}
                >
                  <p className="text-sm font-semibold text-white">{account.method}</p>
                  {account.accountName ? <p className="mt-2 text-sm text-zinc-300">Account: {account.accountName}</p> : null}
                  {account.bankName ? <p className="mt-1 text-sm text-zinc-300">Bank: {account.bankName}</p> : null}
                  {account.accountNumber ? <p className="mt-1 font-mono text-white">Acct No: {account.accountNumber}</p> : null}
                  {account.auraWalletId ? <p className="mt-1 font-mono text-white">Aura ID: {account.auraWalletId}</p> : null}
                  {account.instructions ? <p className="mt-2 text-xs text-zinc-400">{account.instructions}</p> : null}
                </button>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/4 p-4 text-sm text-zinc-300">
              <p>After paying with {selectedPaymentMethod || 'your selected method'}, click the button below to notify the manager.</p>
              <button onClick={handleAcknowledgePayment} className="rounded-xl bg-emerald-600 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white">I have paid</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

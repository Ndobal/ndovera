import { Router } from 'express';
import { z } from 'zod';
import { getDebtorDetail, getTuckshopDashboard, createOrder, upsertPurchaseBlock, upsertPaymentAccount, acknowledgePayment, updateOrderStatus, updateProduct, createProduct, createSale, recordInstallment } from './tuckshop.store.js';

export const tuckshopRouter = Router();

const orderSchema = z.object({
  productId: z.string().trim().min(1),
  quantity: z.number().int().min(1).optional(),
  paymentMethod: z.string().trim().optional(),
  note: z.string().trim().optional(),
  studentUserId: z.string().trim().optional(),
});

const blockSchema = z.object({
  studentUserId: z.string().trim().min(1),
  productId: z.string().trim().min(1),
  blocked: z.boolean(),
  reason: z.string().trim().optional(),
});

const paymentAccountSchema = z.object({
  method: z.string().trim().min(1),
  accountName: z.string().trim().min(1),
  accountNumber: z.string().trim().min(1),
  bankName: z.string().trim().min(1),
  auraWalletId: z.string().trim().optional().default(''),
  instructions: z.string().trim().optional().default(''),
});

const paymentAckSchema = z.object({
  orderId: z.string().trim().min(1),
  method: z.string().trim().min(1),
});

const statusSchema = z.object({
  status: z.enum(['Awaiting supply', 'Pending payment', 'Payment sent', 'Paid']),
});

const updateProductSchema = z.object({
  priceNaira: z.number().nonnegative().optional(),
  stockQuantity: z.number().int().nonnegative().optional(),
  imageUrl: z.string().trim().optional(),
});

const createProductSchema = z.object({
  name: z.string().trim().min(1),
  category: z.string().trim().optional(),
  priceNaira: z.number().nonnegative().optional(),
  stockQuantity: z.number().int().nonnegative().optional(),
  imageUrl: z.string().trim().optional(),
});

const createSaleSchema = z.object({
  buyerUserId: z.string().trim().min(1),
  productId: z.string().trim().min(1),
  quantity: z.number().int().min(1),
  unitPriceNaira: z.number().nonnegative(),
  amountPaidNaira: z.number().nonnegative(),
  paymentSource: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

const installmentSchema = z.object({
  saleId: z.string().trim().min(1),
  amountPaidNaira: z.number().nonnegative(),
  note: z.string().trim().optional(),
});

function getUser(req: any, res: any) {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Unauthenticated' });
    return null;
  }
  return user;
}

tuckshopRouter.get('/dashboard', async (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  try {
    return res.json(await getTuckshopDashboard(user));
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to load tuckshop dashboard.' });
  }
});

tuckshopRouter.get('/debtors/:debtorId', async (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  try {
    return res.json(await getDebtorDetail(user, String(req.params.debtorId || '').trim()));
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to load debtor details.' });
  }
});

tuckshopRouter.post('/orders', async (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  const parsed = orderSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid order payload.' });
  try {
    return res.json({ ok: true, order: await createOrder(user, { ...parsed.data, quantity: parsed.data.quantity ?? 1 }) });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to create order.' });
  }
});

tuckshopRouter.post('/purchase-blocks', async (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  const parsed = blockSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid block payload.' });
  try {
    await upsertPurchaseBlock(user, parsed.data);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to update purchase block.' });
  }
});

tuckshopRouter.post('/payment-accounts', async (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  const parsed = paymentAccountSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payment account payload.' });
  try {
    await upsertPaymentAccount(user, parsed.data);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to save payment account.' });
  }
});

tuckshopRouter.post('/payments/acknowledge', async (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  const parsed = paymentAckSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payment acknowledgement payload.' });
  try {
    await acknowledgePayment(user, parsed.data);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to acknowledge payment.' });
  }
});

tuckshopRouter.post('/orders/:orderId/status', async (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  const parsed = statusSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid order status payload.' });
  try {
    await updateOrderStatus(user, String(req.params.orderId || '').trim(), parsed.data.status);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to update order status.' });
  }
});

tuckshopRouter.post('/products/:productId', async (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  const parsed = updateProductSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid product update payload.' });
  try {
    await updateProduct(user, String(req.params.productId || '').trim(), parsed.data);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to update product.' });
  }
});

tuckshopRouter.post('/products', async (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  const parsed = createProductSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid product payload.' });
  try {
    return res.json({ ok: true, product: await createProduct(user, parsed.data) });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to create product.' });
  }
});

tuckshopRouter.post('/sales', async (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  const parsed = createSaleSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid sale payload.' });
  try {
    return res.json({ ok: true, sale: await createSale(user, parsed.data) });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to save sale.' });
  }
});

tuckshopRouter.post('/installments', async (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  const parsed = installmentSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid installment payload.' });
  try {
    await recordInstallment(user, parsed.data);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to save installment.' });
  }
});

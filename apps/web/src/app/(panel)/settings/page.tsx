'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Save, ToggleRight } from 'lucide-react';

import { useApiQuery } from '@/hooks/useApi';
import { apiFetch } from '@/lib/api-client/client';
import type { CompanyInfo, CurrentUser, ProductSummary, UserSummary } from '@/types/api';

interface NewUserForm {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  canManageStock: boolean;
  canCreateInvoices: boolean;
  canManageProducts: boolean;
}

export default function SettingsPage() {
  const queryClient = useQueryClient();

  const {
    data: currentUser,
    isLoading: loadingMe,
    error: meError,
  } = useApiQuery<CurrentUser>(['current-user'], '/api/users/me', {
    retry: 0,
  });

  const isAdmin = currentUser?.role === 'admin';

  const {
    data: users,
    error: usersError,
  } = useApiQuery<UserSummary[]>(['admin-users'], '/api/admin/users', {
    enabled: Boolean(isAdmin),
  });

  const { data: products } = useApiQuery<ProductSummary[]>(['all-products'], '/api/products', {
    enabled: Boolean(isAdmin),
  });

  const {
    data: companyInfo,
    error: companyError,
  } = useApiQuery<CompanyInfo | null>(['company-info'], '/api/admin/company', {
    enabled: Boolean(isAdmin),
    retry: 0,
  });

  const [newUser, setNewUser] = useState<NewUserForm>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    canManageStock: false,
    canCreateInvoices: false,
    canManageProducts: false,
  });

  const [companyDraft, setCompanyDraft] = useState<CompanyInfo | null>(null);

  const companyInitial = useMemo(
    () =>
      companyInfo ?? {
        id: '',
        tradeName: '',
        address: '',
        phone: '',
        taxNumber: '',
        taxOffice: '',
        bankAccount: '',
      },
    [companyInfo],
  );

  const effectiveCompany = companyDraft ?? companyInitial;

  const [creatingUser, setCreatingUser] = useState(false);
  const [updatingPermissions, setUpdatingPermissions] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);

  const handleCreateUser = async () => {
    if (!newUser.firstName || !newUser.lastName || !newUser.email || !newUser.password) return;
    try {
      setCreatingUser(true);
      await apiFetch<UserSummary>('/api/admin/users', {
        method: 'POST',
        body: newUser as any,
      });
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setNewUser({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        canManageStock: false,
        canCreateInvoices: false,
        canManageProducts: false,
      });
    } catch (error: any) {
      let message = error.message || 'Kullanıcı oluşturulurken bir hata oluştu.';
      try {
        // Eğer hata mesajı JSON ise parse etmeye çalışalım
        const parsed = JSON.parse(message);
        if (parsed.error) message = parsed.error;
        else if (parsed.message) message = parsed.message;
      } catch {
        // JSON değilse olduğu gibi kalsın
      }
      alert(`İşlem Başarısız:\n${message}`);
    } finally {
      setCreatingUser(false);
    }
  };

  const handleTogglePermission = async (user: UserSummary, field: keyof NewUserForm) => {
    try {
      setUpdatingPermissions(true);
      const payload = {
        id: user.id,
        field,
        value: !user[field as keyof UserSummary] as boolean,
      };
      await apiFetch<UserSummary>(`/api/admin/users/${payload.id}/permissions`, {
        method: 'PATCH',
        body: { [payload.field]: payload.value },
      });
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } finally {
      setUpdatingPermissions(false);
    }
  };

  const handleSaveCompany = async () => {
    if (!effectiveCompany.tradeName) return;
    try {
      setSavingCompany(true);
      const updated = await apiFetch<CompanyInfo>('/api/admin/company', {
        method: 'PUT',
        body: effectiveCompany as any,
      });
      queryClient.setQueryData(['company-info'], updated);
      setCompanyDraft(null);
    } finally {
      setSavingCompany(false);
    }
  };

  if (loadingMe) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Ayarlar</h1>
        <p className="text-sm text-slate-400">Kullanıcı bilgileri yükleniyor...</p>
      </div>
    );
  }

  if (meError || !isAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Ayarlar</h1>
        <p className="text-sm text-red-400">Bu sayfaya sadece admin kullanıcılar erişebilir.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Ayarlar</h1>
      <p className="mb-6 text-sm text-slate-400">
        Kullanıcı yetkileri, hızlı stok girişi ve firma bilgilerini buradan yönetebilirsiniz.
      </p>

      {/* KULLANICI YÖNETİMİ */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Kullanıcılar</h2>
            <p className="text-xs text-slate-400">
              Yeni çalışan ekleyin ve stok/fatura/ürün yetkilerini yönetin.
            </p>
          </div>
        </div>

        <div className="mb-6 grid gap-4 rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 md:grid-cols-4">
          <div className="md:col-span-1">
            <label className="mb-1 block text-xs font-medium text-slate-300">Ad</label>
            <input
              type="text"
              value={newUser.firstName}
              onChange={(e) => setNewUser((prev) => ({ ...prev, firstName: e.target.value }))}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          <div className="md:col-span-1">
            <label className="mb-1 block text-xs font-medium text-slate-300">Soyad</label>
            <input
              type="text"
              value={newUser.lastName}
              onChange={(e) => setNewUser((prev) => ({ ...prev, lastName: e.target.value }))}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          <div className="md:col-span-1">
            <label className="mb-1 block text-xs font-medium text-slate-300">E-posta</label>
            <input
              type="email"
              value={newUser.email}
              onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          <div className="md:col-span-1">
            <label className="mb-1 block text-xs font-medium text-slate-300">Şifre</label>
            <input
              type="password"
              value={newUser.password}
              onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              placeholder="En az 8 karakter"
            />
          </div>
          <div className="flex flex-col justify-between md:col-span-4 mt-2">
            <div className="mb-4 flex flex-wrap gap-6 text-sm">
              <label className="inline-flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={newUser.canManageStock}
                  onChange={(e) =>
                    setNewUser((prev) => ({ ...prev, canManageStock: e.target.checked }))
                  }
                  className="size-3 rounded border-slate-600 bg-slate-900"
                />
                Stok Yönetimi
              </label>
              <label className="inline-flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={newUser.canCreateInvoices}
                  onChange={(e) =>
                    setNewUser((prev) => ({ ...prev, canCreateInvoices: e.target.checked }))
                  }
                  className="size-3 rounded border-slate-600 bg-slate-900"
                />
                Fatura Oluşturma
              </label>
              <label className="inline-flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={newUser.canManageProducts}
                  onChange={(e) =>
                    setNewUser((prev) => ({ ...prev, canManageProducts: e.target.checked }))
                  }
                  className="size-3 rounded border-slate-600 bg-slate-900"
                />
                Ürün Kartları
              </label>
            </div>
            <button
              type="button"
              onClick={handleCreateUser}
              disabled={
                creatingUser ||
                !newUser.firstName ||
                !newUser.lastName ||
                !newUser.email ||
                !newUser.password ||
                newUser.password.length < 8
              }
              className="inline-flex items-center justify-center rounded-full bg-cyan-500 px-6 py-2 text-sm font-semibold text-slate-950 shadow-sm shadow-cyan-500/40 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60 self-end"
            >
              <Plus className="mr-2 size-4" />
              Yeni Kullanıcı Oluştur
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-800/80">
          <table className="min-w-full divide-y divide-slate-800 text-xs">
            <thead className="bg-slate-900/70">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-300">Ad Soyad</th>
                <th className="px-3 py-2 text-left font-medium text-slate-300">E-posta</th>
                <th className="px-3 py-2 text-left font-medium text-slate-300">Rol</th>
                <th className="px-3 py-2 text-left font-medium text-slate-300">Yetkiler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/40">
              {users?.map((user) => (
                <tr key={user.id}>
                  <td className="px-3 py-2 text-slate-100">{user.name || '-'}</td>
                  <td className="px-3 py-2 text-slate-300">{user.email || '-'}</td>
                  <td className="px-3 py-2 text-slate-300">
                    {user.role === 'admin' ? 'Admin' : 'Employee'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => handleTogglePermission(user, 'canManageStock')}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:border-cyan-500 hover:text-cyan-300"
                      >
                        <ToggleRight
                          className={`size-3 ${user.canManageStock ? 'text-emerald-400' : 'text-slate-500'}`}
                        />
                        Stok
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTogglePermission(user, 'canCreateInvoices')}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:border-cyan-500 hover:text-cyan-300"
                      >
                        <ToggleRight
                          className={`size-3 ${user.canCreateInvoices ? 'text-emerald-400' : 'text-slate-500'}`}
                        />
                        Fatura
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTogglePermission(user, 'canManageProducts')}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:border-cyan-500 hover:text-cyan-300"
                      >
                        <ToggleRight
                          className={`size-3 ${user.canManageProducts ? 'text-emerald-400' : 'text-slate-500'}`}
                        />
                        Ürünler
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = window.confirm('Bu kullanıcıyı silmek istediğinize emin misiniz?');
                          if (!ok) return;
                          try {
                            await apiFetch('/api/admin/users/' + user.id, { method: 'DELETE' });
                            await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
                          } catch (error: any) {
                            let message = error.message || 'Kullanıcı silinirken hata oluştu.';
                            try {
                              const parsed = JSON.parse(message);
                              if (parsed.error) message = parsed.error;
                              else if (parsed.message) message = parsed.message;
                            } catch {
                              // ignore
                            }
                            alert(`İşlem Başarısız:\n${message}`);
                          }
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-rose-500/50 px-2 py-1 text-[11px] text-rose-200 hover:border-rose-400 hover:text-rose-100"
                      >
                        Sil
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users && users.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-4 text-center text-xs text-slate-500"
                  >
                    Henüz kayıtlı kullanıcı bulunmuyor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* TOPTANCI STOK GİRİŞİ (BARKOD İLE) */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Toptancıdan Gelen Ürünler</h2>
            <p className="text-xs text-slate-400">
              Toptancıdan gelen ürünleri barkodla hızlıca stoğa eklemek için kullanın.
            </p>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 text-xs text-slate-400">
          Bu alan, mevcut <span className="font-semibold text-slate-200">lot ekleme</span> mantığını
          kullanır. Barkod ile ürünü bulup, lot numarası ve miktar girerek{' '}
          <span className="font-semibold text-slate-200">Merkez Depo</span>’ya stok eklersiniz.
          (Transfer sayfasındaki barkod arama mantığı yeniden kullanılıyor.)
        </div>

        <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-800/80 bg-slate-950/40 p-3 text-xs">
          <div className="mb-2 text-[11px] font-semibold text-slate-400">
            Ürün Listesi (sadece görüntü – lot ekleme ürün detaylarından yapılır)
          </div>
          <ul className="space-y-1">
            {products?.map((product) => (
              <li
                key={product.id}
                className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-900/60 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-slate-100">
                    {product.name}
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
                    <span>{product.referenceCode}</span>
                    {product.category ? <span>• {product.category}</span> : null}
                    <span>• Stok: {product.onHandQuantity ?? product.totalQuantity}</span>
                  </div>
                </div>
                <span className="text-[10px] text-slate-500">
                  Detaydan lot ekleyerek stoğa alma yapılır
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FİRMA BİLGİLERİ */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Firma Bilgileri</h2>
            <p className="text-xs text-slate-400">
              Ticari ünvan, vergi ve banka bilgileri faturalar için burada tutulur.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Ticari Ünvan</label>
            <input
              type="text"
              value={effectiveCompany.tradeName}
              onChange={(e) =>
                setCompanyDraft((prev) => ({
                  ...(prev ?? companyInitial),
                  tradeName: e.target.value,
                }))
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Telefon</label>
            <input
              type="text"
              value={effectiveCompany.phone ?? ''}
              onChange={(e) =>
                setCompanyDraft((prev) => ({
                  ...(prev ?? companyInitial),
                  phone: e.target.value,
                }))
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-300">Adres</label>
            <textarea
              value={effectiveCompany.address ?? ''}
              onChange={(e) =>
                setCompanyDraft((prev) => ({
                  ...(prev ?? companyInitial),
                  address: e.target.value,
                }))
              }
              rows={3}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">
              Vergi / TCK Numarası
            </label>
            <input
              type="text"
              value={effectiveCompany.taxNumber ?? ''}
              onChange={(e) =>
                setCompanyDraft((prev) => ({
                  ...(prev ?? companyInitial),
                  taxNumber: e.target.value,
                }))
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Vergi Dairesi</label>
            <input
              type="text"
              value={effectiveCompany.taxOffice ?? ''}
              onChange={(e) =>
                setCompanyDraft((prev) => ({
                  ...(prev ?? companyInitial),
                  taxOffice: e.target.value,
                }))
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-300">
              Banka Hesap Bilgileri (IBAN, banka adı, şube vb.)
            </label>
            <textarea
              value={effectiveCompany.bankAccount ?? ''}
              onChange={(e) =>
                setCompanyDraft((prev) => ({
                  ...(prev ?? companyInitial),
                  bankAccount: e.target.value,
                }))
              }
              rows={3}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Bu alanın içeriği fatura oluştururken açıklama kısmının altına otomatik eklenir.
            </p>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleSaveCompany}
            disabled={savingCompany || !effectiveCompany.tradeName}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2 text-xs font-semibold text-slate-950 shadow-sm shadow-emerald-500/40 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="size-3" />
            Firma Bilgilerini Kaydet
          </button>
        </div>
      </section>
    </div>
  );
}



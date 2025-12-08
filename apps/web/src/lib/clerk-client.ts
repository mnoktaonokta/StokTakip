type TokenGetter = () => Promise<string | null | undefined>;

let clientTokenGetter: TokenGetter | null = null;

export const setClientTokenGetter = (getter: TokenGetter | null) => {
  clientTokenGetter = getter;
};

export const getClientToken = async () => {
  if (!clientTokenGetter) return null;
  try {
    const token = await clientTokenGetter();
    return token ?? null;
  } catch (error) {
    console.warn('Clerk token getter error:', error);
    return null;
  }
};



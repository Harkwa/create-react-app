export type AppSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

function pickFirst(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value[0];
  }
  return undefined;
}

export async function readStatusMessage(searchParams?: AppSearchParams): Promise<{
  type?: string;
  message?: string;
}> {
  if (!searchParams) {
    return {};
  }

  const resolved = await searchParams;
  return {
    type: pickFirst(resolved.type),
    message: pickFirst(resolved.message),
  };
}

export async function readStatusAndEmail(
  searchParams?: AppSearchParams,
): Promise<{
  type?: string;
  message?: string;
  email?: string;
}> {
  if (!searchParams) {
    return {};
  }

  const resolved = await searchParams;
  return {
    type: pickFirst(resolved.type),
    message: pickFirst(resolved.message),
    email: pickFirst(resolved.email),
  };
}

export function scopedOrgWhere<T extends { orgId?: string }>(
  where: T | undefined,
  orgId: string,
): T & { orgId: string } {
  return {
    ...(where ?? ({} as T)),
    orgId,
  };
}

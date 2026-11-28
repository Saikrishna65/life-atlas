import {accountConfig, accountId, seal, unseal} from './security';
import {newRecoveryCode} from '../cloud-vault/codec';
/** Encrypted server escrow. Existing native R2 keys are NOT exported or migrated here. */
export async function accountRecoveryCode(subject: string) {
  const id = accountId(subject), config = accountConfig();
  const {default: prisma} = await import('../prisma');
  const {controlCloudFiles} = await import('../control-room/cloud-server');
  return prisma.$transaction(async db => {
    await db.$queryRaw`SELECT 1::int AS acquired FROM pg_advisory_xact_lock(hashtextextended(${`account:${id}`},0))`;
    const files = controlCloudFiles('music'), path = `atlas-system/accounts/${id}/recovery-v1.json`;
    if (await files.exists(path)) {
      const record = unseal<{code: string}>((await (await files.download(path)).text()), `recovery:${id}`, config.key);
      if (!/^ATLAS-(?:[a-f0-9]{8}-){7}[a-f0-9]{8}$/.test(record.code)) throw new Error('Invalid recovery record.');
      return record.code;
    }
    const code = newRecoveryCode();
    await files.upload(path, seal({code}, `recovery:${id}`, config.key), {contentType:'application/octet-stream', cacheControl:'no-store'});
    return code;
  }, {timeout:30000, maxWait:10000});
}

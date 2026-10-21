import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ server: vi.fn(), rpc: vi.fn(), getUser: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), is: vi.fn(), maybeSingle: vi.fn(), storageFrom: vi.fn(), upload: vi.fn(), remove: vi.fn(), download: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ supabaseServer: db.server }));
import { GET, POST } from '@/app/api/partner/operations/media/route';
import { DELETE } from '@/app/api/partner/operations/media/[id]/route';
import { GET as publicGET } from '@/app/api/places/[id]/media/route';
import { merchantMedia, MERCHANT_MEDIA_MAX_BYTES } from '@/lib/partner/media-contracts';

const id = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const merchantId = '33333333-3333-4333-8333-333333333333';
const serviceId = '44444444-4444-4444-8444-444444444444';
const customerId = '55555555-5555-4555-8555-555555555555';
const updatedAt = '2026-10-20T10:00:00.123456+00:00';
const startAt = '2026-10-21T10:00:00+09:00';
const route = (value = id) => ({ params: Promise.resolve({ id: value }) });
const get = (suffix = '') => new Request(`https://example.test/api/partner/operations/bookings${suffix}`);
const write = (body: unknown, suffix = '', origin = 'https://example.test') => new Request(`https://example.test/api/partner/operations/bookings${suffix}`, {
  method: suffix ? 'PATCH' : 'POST', headers: { Origin: origin, Host: 'example.test', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const result = (data: unknown, error: unknown = null) => db.rpc.mockResolvedValue({ data, error });
function membership(status = 'active') {
  db.maybeSingle.mockResolvedValueOnce({ data: { merchant_id: merchantId, user_id: userId, revoked_at: null }, error: null });
  db.maybeSingle.mockResolvedValueOnce({ data: { id: merchantId, display_name: 'Salon', contact_email: '', contact_phone: '', address: '', business_types: ['hair'], status, booking_enabled: true, updated_at: updatedAt }, error: null });
}
beforeEach(() => {
  vi.resetAllMocks();
  db.server.mockReturnValue({ auth: { getUser: db.getUser }, rpc: db.rpc, from: db.from, storage: { from: db.storageFrom } });
  db.from.mockReturnValue({ select: db.select }); db.select.mockReturnValue({ eq: db.eq });
  db.eq.mockReturnValue({ is: db.is, maybeSingle: db.maybeSingle }); db.is.mockReturnValue({ maybeSingle: db.maybeSingle });
  db.storageFrom.mockReturnValue({ upload: db.upload, remove: db.remove, download: db.download });
  db.upload.mockResolvedValue({ data: {}, error: null }); db.remove.mockResolvedValue({ data: [], error: null });
  db.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
});


const raw={id,targetKind:'staff',targetId:serviceId,status:'active',objectPath:merchantId+'/'+id+'.webp',width:1,height:1,createdAt:updatedAt,updatedAt};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aOWQAAAAASUVORK5CYII=','base64');
function uploadRequest(bytes:Buffer=png,mime='image/png',origin='https://example.test') {
 const form=new FormData();form.set('targetKind','staff');form.set('targetId',serviceId);form.set('requestId',customerId);form.set('file',new File([new Uint8Array(bytes)],'picture.png',{type:mime}));
 return new Request('https://example.test/api/partner/operations/media',{method:'POST',headers:{Origin:origin,Host:'example.test'},body:form});
}
describe('merchant image upload boundary',()=>{
 it('returns scoped attachment URLs without leaking internal storage paths',async()=>{
  membership();result([raw]);const response=await GET(get('?targetKind=staff&targetId='+serviceId));expect(response.status).toBe(200);
  const media=(await response.json()).media[0];expect(merchantMedia(media)).toBe(true);expect(media.objectPath).toBeUndefined();expect(media.url).toBe('/api/partner/operations/media/'+id+'/content');
 });
 it('publishes only active media with public scoped content URLs',async()=>{
  result([raw]);const response=await publicGET(get(),route('known'));expect(response.status).toBe(200);expect((await response.json()).media[0].url).toBe('/api/places/known/media/'+id);
  expect(db.getUser).not.toHaveBeenCalled();result([{...raw,status:'pending'}]);expect((await publicGET(get(),route('known'))).status).toBe(503);
 });
 it('requires same-origin multipart uploads and validates the decoded image',async()=>{
  expect((await POST(uploadRequest(png,'image/png','https://attacker.test'))).status).toBe(403);
  membership();expect((await POST(uploadRequest(Buffer.from('<svg/>'),'image/svg+xml'))).status).toBe(400);
  membership();expect((await POST(uploadRequest(Buffer.from('Not an image'),'image/png'))).status).toBe(400);
  expect(db.rpc).not.toHaveBeenCalled();
 });
 it('bounds upload bytes before allowing storage writes',async()=>{
  membership();expect((await POST(uploadRequest(Buffer.alloc(MERCHANT_MEDIA_MAX_BYTES+1)))).status).toBe(413);expect(db.upload).not.toHaveBeenCalled();
 });
 it('reencodes valid images to immutable WebP objects before activation',async()=>{
  membership();db.rpc.mockResolvedValueOnce({data:{...raw,status:'uploading'},error:null}).mockResolvedValueOnce({data:raw,error:null});
  const response=await POST(uploadRequest());expect(response.status).toBe(201);
  expect(db.upload).toHaveBeenCalledWith(raw.objectPath,expect.any(Buffer),{contentType:'image/webp',upsert:false,cacheControl:'60'});
  expect(db.rpc).toHaveBeenCalledWith('partner_media_finalize',{p_id:id});
 });
 it('returns an already saved retry without uploading a duplicate object',async()=>{
  membership();result(raw);expect((await POST(uploadRequest())).status).toBe(201);expect(db.upload).not.toHaveBeenCalled();
 });
 it('checks the deletion version and removes only the stored object path',async()=>{
  membership();result({...raw,status:'deleted'});expect((await DELETE(write({expectedUpdatedAt:updatedAt}),route())).status).toBe(200);
  expect(db.remove).toHaveBeenCalledWith([raw.objectPath]);
  expect((await DELETE(write({expectedUpdatedAt:updatedAt,objectPath:'foreign'}),route())).status).toBe(400);
 });
});

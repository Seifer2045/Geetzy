'use client';

import { useActionState, useState } from 'react';
import { saveTemplate, deleteTemplate, type StudioStatus, type TplState } from '@/app/(dash)/templates/actions';
import { nearestTier } from '@/lib/pricing';
import { ArtUpload } from './ArtUpload';
import { AudioCropper } from './AudioCropper';
import { LayoutPicker, LayoutSketch, type LayoutOption } from './LayoutPicker';
import { LivePreview } from './LivePreview';
import { MovieDesigner } from './MovieDesigner';
import { PromptField } from './PromptField';
import { StudioPanel } from './StudioPanel';

export type TemplateData = {
  id?: string; name: string; category_id: string; description: string; tags: string[]; style: string;
  layout_id: string | null; video_prompt: string; movie_prompt: string; movie_json: string; movie_status: string; movie_error: string | null; song_prompt: string; song_instrumental: boolean;
  default_song_path: string | null; default_song_start_sec: number; art_upload_path: string | null;
  photos_min: number; photos_max: number; song_mode: string; duration_sec: number; price_tier_id: string;
  custom_price_inr: number | null; original_price_inr: number | null; color_from: string; color_to: string;
  render_config: unknown; trending: boolean; is_active: boolean;
};
type Cat = { id: string; name: string; emoji: string | null };
type Tier = { id: string; price_inr: number };

export const EMPTY_TEMPLATE: TemplateData = {
  name: '', category_id: '', description: '', tags: [], style: 'bollywood', layout_id: null, video_prompt: '',
  movie_prompt: '', movie_json: '', movie_status: 'none', movie_error: null,
  song_prompt: '', song_instrumental: false, default_song_path: null, default_song_start_sec: 0, art_upload_path: null,
  photos_min: 3, photos_max: 5, song_mode: 'both', duration_sec: 15, price_tier_id: 'tier_49', custom_price_inr: null,
  original_price_inr: null, color_from: '#FF4D8D', color_to: '#C04CF0', render_config: {}, trending: false, is_active: true,
};

const SONG_LABEL: Record<string, string> = {
  both: 'AI song (ElevenLabs) or the user’s own', ai: 'AI song (ElevenLabs)', upload: 'The user’s own song',
  fixed: 'Template song (same for everyone)', none: 'No song (silent)',
};

function Step({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-sm font-semibold text-ink-2">{n}. {title}</h2>
      {hint && <span className="text-xs text-ink-faint">{hint}</span>}
    </div>
  );
}

export function TemplateStudio({
  t, categories, tiers, layouts, isImage, canDelete, studio, songUrl, artUrl,
}: {
  t: TemplateData; categories: Cat[]; tiers: Tier[]; layouts: LayoutOption[]; isImage: boolean;
  canDelete: boolean; studio: StudioStatus | null; songUrl: string | null; artUrl: string | null;
}) {
  const [state, action, pending] = useActionState<TplState, FormData>(saveTemplate, {});
  const options = layouts.filter((l) => (l.kind === 'image') === isImage);
  const [name, setName] = useState(t.name);
  const [categoryId, setCategoryId] = useState(t.category_id);
  const [description, setDescription] = useState(t.description);
  const [colorFrom, setColorFrom] = useState(t.color_from);
  const [colorTo, setColorTo] = useState(t.color_to);
  const [layoutId, setLayoutId] = useState(t.layout_id ?? (t.id ? '' : options[0]?.id ?? ''));
  const [videoPrompt, setVideoPrompt] = useState(t.video_prompt);
  const [songPrompt, setSongPrompt] = useState(t.song_prompt);
  const [songMode, setSongMode] = useState(t.song_mode);
  const [duration, setDuration] = useState(t.duration_sec);
  const [min, setMin] = useState(t.photos_min);
  const [max, setMax] = useState(t.photos_max);
  const [tierId, setTierId] = useState(t.price_tier_id);
  const [custom, setCustom] = useState<string>(t.custom_price_inr ? String(t.custom_price_inr) : '');
  const [original, setOriginal] = useState<string>(t.original_price_inr ? String(t.original_price_inr) : '');
  const [bgUrl, setBgUrl] = useState<string | null>(artUrl);

  const layout = options.find((l) => l.id === layoutId) ?? null;
  const category = categories.find((c) => c.id === categoryId);
  const customNum = Number(custom) > 0 ? Math.round(Number(custom)) : null;
  const tierPrice = tiers.find((x) => x.id === tierId)?.price_inr ?? null;
  const price = customNum ?? tierPrice;
  const snapped = customNum && tiers.length ? nearestTier(customNum, tiers) : null;
  const usesAi = songMode === 'ai' || songMode === 'both';
  const hasSongPart = !isImage && songMode !== 'none';

  return (
    <div className="space-y-4">
      <form action={action} className="grid gap-4 lg:grid-cols-3">
        {t.id && <input type="hidden" name="id" value={t.id} />}

        <section className="card space-y-3 p-4 lg:col-span-3">
          <Step n={1} title="Basics" />
          <div className="grid gap-3 md:grid-cols-2">
            <div><label className="label">Template name</label>
              <input name="name" value={name} onChange={(e) => setName(e.target.value)} className="input" required maxLength={60} /></div>
            <div><label className="label">Category (decides where the app shows it)</label>
              <select name="category_id" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input" required>
                <option value="" disabled>Select…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
              </select></div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div><label className="label">Short description (shown in the app)</label>
              <input name="description" value={description} onChange={(e) => setDescription(e.target.value)} className="input" maxLength={300} /></div>
            <div><label className="label">Tags (comma separated)</label>
              <input name="tags" defaultValue={t.tags.join(', ')} className="input" placeholder="filmy, romantic, party" /></div>
          </div>
        </section>

        <section className="card space-y-3 p-4 lg:col-span-3">
          <Step n={2} title={isImage ? 'Layout — where the user’s photos go' : 'Video — photos and text'}
            hint={layout ? (isImage ? `User adds exactly ${layout.photo_count} photo${layout.photo_count > 1 ? 's' : ''}` : 'Each photo appears inside this frame, one per scene') : undefined} />
          <LayoutPicker layouts={options} value={layoutId} onChange={setLayoutId} allowNone={!!t.id && !t.layout_id} />

          {!isImage && (
            <div className="grid gap-4 pt-1 lg:grid-cols-2">
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div><label className="label">Min photos</label>
                    <input name="photos_min" type="number" min={1} max={10} value={min} onChange={(e) => setMin(Number(e.target.value))} className="input" /></div>
                  <div><label className="label">Max photos</label>
                    <input name="photos_max" type="number" min={1} max={10} value={max} onChange={(e) => setMax(Number(e.target.value))} className="input" /></div>
                  <div><label className="label">Length (sec)</label>
                    <input name="duration_sec" type="number" min={5} max={60} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="input" /></div>
                </div>
                <p className="text-xs text-ink-faint">
                  The app asks the user for {min === max ? min : `${min} to ${max}`} photo(s). The video is built with exactly the number of photos
                  they add — one scene each, always {duration}s in total.
                </p>
                <div><label className="label">Visual style (font, transition)</label>
                  <select name="style" defaultValue={t.style} className="input">
                    <option value="bollywood">Bollywood</option><option value="retro">Retro</option><option value="genz">Gen Z</option>
                  </select></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Colour from</label>
                    <input name="color_from" type="color" value={colorFrom} onChange={(e) => setColorFrom(e.target.value)} className="h-10 w-full rounded-lg bg-transparent" /></div>
                  <div><label className="label">Colour to</label>
                    <input name="color_to" type="color" value={colorTo} onChange={(e) => setColorTo(e.target.value)} className="h-10 w-full rounded-lg bg-transparent" /></div>
                </div>
              </div>
              <PromptField
                name="video_prompt" label="Captions for the built-in design (used when there is no Grok JSON)" value={videoPrompt} onChange={setVideoPrompt} maxLength={300}
                keys={['name', 'sender', 'fun_fact', 'occasion']}
                placeholder={'Line 1 = opening title, line 2 = closing line.\ne.g.\nHappy Birthday, {name}! 🎉\nWith love, {sender}'}
                help="Line 1 is shown on the first scene, line 2 on the last. Empty = the standard text. With a Grok design below, the text comes from that design instead."
              />
            </div>
          )}
          {!isImage && (
            <MovieDesigner
              id={t.id} initialPrompt={t.movie_prompt} initialJson={t.movie_json} initialStatus={t.movie_status}
              initialError={t.movie_error} photosMin={min} photosMax={max}
            />
          )}
          {isImage && (
            <>
              <div className="grid max-w-sm grid-cols-2 gap-3">
                <div><label className="label">Colour from</label>
                  <input name="color_from" type="color" value={colorFrom} onChange={(e) => setColorFrom(e.target.value)} className="h-10 w-full rounded-lg bg-transparent" /></div>
                <div><label className="label">Colour to</label>
                  <input name="color_to" type="color" value={colorTo} onChange={(e) => setColorTo(e.target.value)} className="h-10 w-full rounded-lg bg-transparent" /></div>
              </div>
              <input type="hidden" name="style" value={t.style} />
              <input type="hidden" name="duration_sec" value="15" />
              <input type="hidden" name="photos_min" value={layout?.photo_count ?? 1} />
              <input type="hidden" name="photos_max" value={layout?.photo_count ?? 1} />
            </>
          )}
        </section>

        {!isImage ? (
          <section className="card space-y-4 p-4 lg:col-span-3">
            <Step n={3} title="Song" hint="ElevenLabs makes the AI song. Your own song costs nothing." />
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-3">
                <div><label className="label">Who chooses the song?</label>
                  <select name="song_mode" value={songMode} onChange={(e) => setSongMode(e.target.value)} className="input">
                    <option value="both">User picks: AI song or their own</option>
                    <option value="ai">AI song only</option>
                    <option value="upload">User’s own song only</option>
                    <option value="fixed">Template song — same song for every video (no AI cost)</option>
                    <option value="none">No song (silent video)</option>
                  </select></div>
                {usesAi && (
                  <>
                    <PromptField
                      name="song_prompt" label="Audio prompt for ElevenLabs" value={songPrompt} onChange={setSongPrompt}
                      keys={['name', 'sender', 'fun_fact', 'occasion']}
                      placeholder={'e.g. "Upbeat Bollywood dhol-pop birthday song for {name}. Sing {name}\'s name in the chorus and mention {fun_fact}. Cheerful, filmy, ends with a warm wish from {sender}."'}
                      help="Replaced with each user's details, then sent to ElevenLabs once per video. Describe the music and what to sing."
                    />
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="song_instrumental" defaultChecked={t.song_instrumental} /> Music only, no singing
                    </label>
                  </>
                )}
              </div>
              {songMode !== 'none' && (
              <div className="space-y-2">
                  <label className="label">
                    {songMode === 'fixed' ? 'Template song (required) — pick the part to play' : 'Own song for this template (optional) — used for the preview'}
                  </label>
                  <AudioCropper windowSec={duration} initialPath={t.default_song_path} initialUrl={songUrl} initialStart={t.default_song_start_sec} />
                  <p className="text-xs text-ink-faint">
                    Upload a full song, then drag to choose the {duration}-second part. {songMode === 'fixed'
                      ? 'Every video made from this template uses this part.'
                      : 'The preview uses this instead of paying ElevenLabs for a sample.'}
                  </p>
                </div>
              )}
            </div>
          </section>
        ) : (
          <>
            <input type="hidden" name="song_mode" value="none" />
            <input type="hidden" name="video_prompt" value="" />
          </>
        )}

        <section className="card space-y-3 p-4 lg:col-span-3">
          <Step n={isImage ? 3 : 4} title="Background picture" hint="Optional. Without one, the two colours make a gradient (free)." />
          <ArtUpload initialPath={t.art_upload_path} initialUrl={artUrl} onPreview={setBgUrl} />
        </section>

        <section className="card space-y-3 p-4 lg:col-span-3">
          <Step n={isImage ? 4 : 5} title="Price & visibility" />
          <div className="grid gap-3 md:grid-cols-4">
            <div><label className="label">Standard price</label>
              <select name="price_tier_id" value={tierId} onChange={(e) => setTierId(e.target.value)} className="input">
                {tiers.map((p) => <option key={p.id} value={p.id}>₹{p.price_inr}</option>)}
              </select></div>
            <div><label className="label">Custom price ₹ (optional)</label>
              <input name="custom_price_inr" type="number" min={1} max={9999} value={custom} onChange={(e) => setCustom(e.target.value)} className="input" placeholder="e.g. 59" /></div>
            <div><label className="label">Strike-through ₹</label>
              <input name="original_price_inr" type="number" min={1} value={original} onChange={(e) => setOriginal(e.target.value)} className="input" /></div>
            <div className="flex flex-col justify-end gap-1 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" name="trending" defaultChecked={t.trending} /> Trending badge</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="is_active" defaultChecked={t.is_active} /> Visible when published</label>
            </div>
          </div>
          <p className="text-xs text-ink-faint">
            {customNum && snapped
              ? <>The app shows <b className="text-gold">₹{customNum}</b>. Google Play can only charge fixed prices, so it bills the nearest one (<b>₹{snapped.price_inr}</b>) until you add more Play products.</>
              : 'Empty custom price = the standard price above.'}
          </p>
        </section>

        <details className="card p-4 lg:col-span-3">
          <summary className="cursor-pointer text-sm text-ink-muted">Advanced video settings (JSON)</summary>
          <textarea name="render_config" defaultValue={JSON.stringify(t.render_config ?? {}, null, 2)} rows={4} className="input mt-2 font-mono text-xs" />
          <p className="mt-1 text-xs text-ink-faint">Optional overrides like {'{"font":"Poppins","transition":"slideleft"}'}.</p>
        </details>

        {/* ───────── bottom: preview + save */}
        <section className="card space-y-4 p-4 lg:col-span-3">
          <Step n={isImage ? 5 : 6} title="Preview" hint="Updates as you type" />
          <LivePreview
            name={name} emoji={category?.emoji ?? '🎁'} categoryName={category?.name ?? ''} colorFrom={colorFrom} colorTo={colorTo}
            slots={layout?.slots ?? []} isImage={isImage} photosMin={min} photosMax={max} durationSec={duration}
            videoPrompt={videoPrompt} price={price} originalPrice={Number(original) > 0 ? Number(original) : null} bgUrl={bgUrl}
            songLabel={hasSongPart ? SONG_LABEL[songMode] : isImage ? 'Not used (photo template)' : SONG_LABEL.none} description={description}
          />
        </section>

        <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-bg/90 p-3 backdrop-blur lg:col-span-3">
          <button className="btn-glass" name="intent" value="save" disabled={pending}>{pending ? 'Saving…' : t.id ? 'Save changes' : 'Save draft'}</button>
          <button className="btn-primary" name="intent" value="preview" disabled={pending}>Save &amp; generate preview</button>
          {state.error && <p className="text-sm text-danger">{state.error}</p>}
          {state.ok && <p className="text-sm text-ok">{state.message ?? 'Saved ✓'}</p>}
          {!t.id && <p className="text-xs text-ink-faint">The real video preview appears below after saving.</p>}
        </div>
      </form>

      {t.id && studio && t.layout_id && layout && (
        <StudioPanel id={t.id} initial={studio} slots={layout.slots} isImage={isImage} />
      )}
      {t.id && !t.layout_id && (
        <p className="card p-4 text-sm text-ink-muted">
          This is a classic template (no layout). Pick a layout above and save to turn it into a studio template.
          It stays live as it is until you do.
        </p>
      )}
      {t.id && canDelete && <DeleteTemplate id={t.id} />}
    </div>
  );
}

function DeleteTemplate({ id }: { id: string }) {
  const [state, action, pending] = useActionState<TplState, FormData>(deleteTemplate, {});
  return (
    <form action={action} className="flex items-center gap-3">
      <input type="hidden" name="id" value={id} />
      <button className="btn-danger" disabled={pending}>Delete template</button>
      {state.error && <span className="text-sm text-danger">{state.error}</span>}
    </form>
  );
}

export { LayoutSketch };

export type TemplateData = {
  id?: string; name: string; category_id: string; description: string; tags: string[]; style: string;
  layout_id: string | null; video_prompt: string; movie_json: string; song_prompt: string; song_instrumental: boolean;
  song_json: string; song_status: string; song_error: string | null;
  default_song_path: string | null; default_song_start_sec: number; art_upload_path: string | null;
  photos_min: number; photos_max: number; song_mode: string; duration_sec: number; price_tier_id: string;
  custom_price_inr: number | null; original_price_inr: number | null; color_from: string; color_to: string;
  render_config: unknown; trending: boolean; is_active: boolean;
};

export const EMPTY_TEMPLATE: TemplateData = {
  name: '', category_id: '', description: '', tags: [], style: 'bollywood', layout_id: null, video_prompt: '',
  movie_json: '', song_json: '', song_status: 'none', song_error: null,
  song_prompt: '', song_instrumental: false, default_song_path: null, default_song_start_sec: 0, art_upload_path: null,
  photos_min: 3, photos_max: 5, song_mode: 'both', duration_sec: 15, price_tier_id: 'tier_49', custom_price_inr: null,
  original_price_inr: null, color_from: '#FF4D8D', color_to: '#C04CF0', render_config: {}, trending: false, is_active: true,
};

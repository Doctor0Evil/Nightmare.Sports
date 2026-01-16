#[derive(Clone, Copy, Debug)]
pub struct NightmareSportsOutcomeProfile {
    // mean change in anger (next-day minus pre-session), cohort-level
    pub mean_delta_anger: f32,
    // mean change in urge-to-act
    pub mean_delta_urge_to_act: f32,
    // change in nightmares per week (NS – baseline)
    pub nightmare_rate_change: f32,
    // change in waking console hours feeding Rc
    pub console_hours_change: f32,
    // mean Dream Anger Discharge Index under same gate
    pub mean_dadi: f32,
    // fraction of sessions with autonomic instability or UnsafeDefer
    pub safety_incident_rate: f32,
}

#[derive(Clone, Debug)]
pub struct MermaidLabelRisk {
    pub has_html_br: bool,        // <br/> or <br>
    pub has_math_ops: bool,       // = * + - / ^
    pub has_pipes: bool,          // |
    pub quoted: bool,             // label wrapped in "..."
    pub surrounding_whitespace_ok: bool, // spaces around =,* inside label
}

#[derive(Clone, Debug)]
pub struct MermaidSafetyProfile {
    pub line_number: u32,
    pub raw_line: String,
    pub is_node_def: bool,
    pub is_edge_def: bool,
    pub label_risk: MermaidLabelRisk,
    pub autoconvertible: bool,    // can be auto‑fixed without changing graph topology
}

impl MermaidSafetyProfile {
    pub fn needs_quoting(&self) -> bool {
        !self.label_risk.quoted
            && (self.label_risk.has_html_br
                || self.label_risk.has_math_ops
                || self.label_risk.has_pipes)
    }

    pub fn is_high_risk(&self) -> bool {
        self.needs_quoting() && !self.label_risk.surrounding_whitespace_ok
    }
}

// Hex-stamp (MermaidSafetyProfile v1, DreamLearner space):
// 0x8f2c3a19d4b740e6a7c1f9e305bd7a92

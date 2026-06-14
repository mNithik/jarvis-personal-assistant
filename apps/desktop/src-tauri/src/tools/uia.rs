use serde_json::{json, Value};
use uiautomation::core::{UIAutomation, UIElement};
use windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow;

const MAX_DEPTH: usize = 6;
const MAX_CHILDREN: usize = 40;

pub fn read_foreground_tree() -> Result<Value, String> {
    let automation = UIAutomation::new().map_err(|error| error.to_string())?;
    let hwnd = unsafe { GetForegroundWindow() };
    if hwnd.0.is_null() {
        return Err("No foreground window is available.".to_string());
    }

    let root = automation
        .element_from_handle(hwnd.into())
        .map_err(|error| error.to_string())?;
    let window_name = root.get_name().unwrap_or_default();
    let tree = serialize_element(&automation, &root, 0)?;

    Ok(json!({
        "windowTitle": window_name,
        "controlType": root.get_control_type().ok().map(|value| format!("{value:?}")).unwrap_or_else(|| "unknown".to_string()),
        "tree": tree,
    }))
}

fn serialize_element(
    automation: &UIAutomation,
    element: &UIElement,
    depth: usize,
) -> Result<Value, String> {
    if depth > MAX_DEPTH {
        return Ok(json!({
            "name": element.get_name().unwrap_or_default(),
            "truncated": true,
        }));
    }

    let name = element.get_name().unwrap_or_default();
    let control_type = element
        .get_control_type()
        .ok()
        .map(|value| format!("{value:?}"))
        .unwrap_or_else(|| "unknown".to_string());
    let mut children = Vec::new();

    if depth < MAX_DEPTH {
        let walker = automation
            .get_control_view_walker()
            .map_err(|error| error.to_string())?;
        if let Ok(mut child) = walker.get_first_child(element) {
            for _ in 0..MAX_CHILDREN {
                children.push(serialize_element(automation, &child, depth + 1)?);
                match walker.get_next_sibling(&child) {
                    Ok(next) => child = next,
                    Err(_) => break,
                }
            }
        }
    }

    Ok(json!({
        "name": name,
        "controlType": control_type,
        "children": children,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_foreground_tree_returns_json_object() {
        let result = read_foreground_tree();
        if result.is_err() {
            return;
        }
        let value = result.expect("tree");
        assert!(value.get("windowTitle").is_some());
        assert!(value.get("tree").is_some());
    }
}

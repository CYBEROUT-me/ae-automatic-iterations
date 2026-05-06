// lib/naming.jsx — project ID increment

function incrementProjectId(nameWithoutExt) {
    var parts = nameWithoutExt.split("_");
    parts[1]  = String(parseInt(parts[1], 10) + 1);
    return parts.join("_");
}

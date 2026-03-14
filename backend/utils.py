def generate_filename(song_name: str, extension: str) -> str:
    """
    Generate a safe filename from a song name with the given extension.
    
    Args:
        song_name: The name of the song
        extension: The file extension (without the dot, e.g., 'json', 'mid')
        
    Returns:
        A safe filename with the given extension
    """
    if not song_name:
        return f"song.{extension}"
    
    # Clean the name: replace spaces with hyphens, limit to 35 chars
    safe_name = song_name.replace(' ', '-')[:35]
    # Remove non-alphanumeric characters except hyphens
    safe_name = ''.join(c for c in safe_name if c.isalnum() or c == '-')
    # Remove leading/trailing hyphens and replace multiple consecutive hyphens
    safe_name = safe_name.strip('-')
    while '--' in safe_name:
        safe_name = safe_name.replace('--', '-')
    
    if safe_name:
        return f"{safe_name}.{extension}"
    else:
        return f"song.{extension}"

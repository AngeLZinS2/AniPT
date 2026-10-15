#[tauri::command]
pub async fn translate_synopsis_segment(text:String)->Result<String,String>{
    if text.trim().is_empty()||text.len()>400{return Err("Segmento de sinopse inválido".into());}
    let data:serde_json::Value=reqwest::Client::builder().timeout(std::time::Duration::from_secs(20)).build().map_err(|_|"Cliente de tradução indisponível")?.get("https://api.mymemory.translated.net/get").query(&[("q",text.as_str()),("langpair","en|pt-BR")]).send().await.map_err(|_|"O serviço de tradução não respondeu")?.error_for_status().map_err(|_|"Serviço de tradução indisponível")?.json().await.map_err(|_|"Resposta de tradução inválida")?;
    let status=data.get("responseStatus").and_then(|v|v.as_i64().or_else(||v.as_str().and_then(|s|s.parse().ok())));
    let text=data.pointer("/responseData/translatedText").and_then(|v|v.as_str()).unwrap_or("");
    if status!=Some(200)||data.get("quotaFinished").and_then(|v|v.as_bool())==Some(true)||text.is_empty()||text.to_lowercase().contains("mymemory warning"){return Err("O serviço de tradução está indisponível ou atingiu seu limite. O original foi preservado.".into());}
    Ok(text.into())
}

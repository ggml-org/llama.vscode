/*

Here a the prompt to get the transation from LLM (update the last row with the strings, whcih should be translated; first check if the string already exists):

# Background information

I am translating the UI of an application from English to other languages. 

# Instruction

I will give you several expressions in English, separated by "|".  I'd like you to translate each of them into the following languages: Bulgarian, German, Russian, Spanish, Chinese, French. 

# Example output

Please show each translation in a separate row. Start each row with "[" and finish it with "],". Start with the English expression. Here is a concrete example to illustrate how I want you to format the output if you give as input "no suggestion|thinking..."

["no suggestion", "нямам предложение", "kein Vorschlag", "нет предложения", "ninguna propuesta", "无建议", "pas de suggestion"], 
["thinking...", "мисля...", "Ich denke...", "думаю...", "pensando...", "思考...", "pense..."],

Edit Settings...|View Documentation...|Chat with AI|Chat with AI with project context

*/


export const translations: string[][] = [
    ["no suggestion", "нямам предложение", "kein Vorschlag", "нет предложения", "ninguna propuesta", "无建议", "pas de suggestion"],
    ["thinking...", "мисля...", "Ich denke...", "думаю...", "pensando...", "思考...", "pense..."],
    ["Edit Settings...", "Редактиране на настройките...", "Einstellungen bearbeiten...", "Изменить настройки...", "Editar ajustes...", "编辑设置...", "Modifier les paramètres..."],
    ["View Documentation...", "Преглед на документацията...", "Dokumentation anzeigen...", "Просмотреть документацию...", "Ver la documentación...", "查看文档...", "Voir la documentation..."],
    ["Chat with AI", "Чат с ИИ", "Mit KI chatten", "Чат с ИИ", "Chatear con IA", "与 AI 聊天", "Discuter avec l'IA"],
    ["Chat with AI with project context", "Чат с ИИ с контекст на проекта", "Mit KI chatten mit Projektkontext", "Чат с ИИ с контекстом проекта", "Chatear con IA con contexto del proyecto", "在项目上下文中与 AI 聊天", "Discuter avec l'IA avec le contexte du projet"],
    ["Opens a chat with AI window inside VS Code using server from property endpoint_chat", "Отваря чат с AI прозорец в рамките на VS Code, използвайки сървър от свойството endpoint_chat", "Öffnet ein Chat-Fenster mit KI in VS Code unter Verwendung des Servers aus der Eigenschaft endpoint_chat", "Открывает окно чата с ИИ внутри VS Code, используя сервер из свойства endpoint_chat", "Abre una ventana de chat con IA dentro de VS Code utilizando el servidor de la propiedad endpoint_chat", "在 VS Code 内使用属性 endpoint_chat 的服务器打开 AI 聊天窗口", "Ouvre une fenêtre de chat avec l'IA dans VS Code en utilisant le serveur défini dans la propriété endpoint_chat"], 
    ["Opens a chat with AI window with project context inside VS Code using server from property endpoint_chat", "Отваря чат с AI прозорец с контекст на проекта в рамките на VS Code, използвайки сървър от свойството endpoint_chat", "Öffnet ein Chat-Fenster mit KI und Projektkontext in VS Code unter Verwendung des Servers aus der Eigenschaft endpoint_chat", "Открывает окно чата с ИИ с контекстом проекта внутри VS Code, используя сервер из свойства endpoint_chat", "Abre una ventana de chat con IA con contexto del proyecto dentro de VS Code utilizando el servidor de la propiedad endpoint_chat", "在 VS Code 内使用属性 endpoint_chat 的服务器打开带有项目上下文的 AI 聊天窗口", "Ouvre une fenêtre de chat avec l'IA incluant le contexte du projet dans VS Code en utilisant le serveur défini dans la propriété endpoint_chat"],
    ["Disable", "Деактивиране", "Deaktivieren", "Отключить", "Desactivar", "禁用", "Désactiver"], 
    ["Enable", "Активиране", "Aktivieren", "Включить", "Activar", "启用", "Activer"], 
    ["Completions for", "Завършване за", "Vervollständigungen für", "Завершения для", "Completaciones para", "完成建议适用于", "Complétions pour"], 
    ["Currently", "В момента", "Derzeit", "В настоящее время", "Actualmente", "目前", "Actuellement"], 
    ["enabled", "активирано", "aktiviert", "включено", "habilitado", "已启用", "activé"], 
    ["disabled", "деактивирано", "deaktiviert", "отключено", "deshabilitado", "已禁用", "désactivé"], 
    ["All Completions", "Всички завършвания", "Alle Vervollständigungen", "Все автозаполнения", "Todas las completaciones", "所有补全", "Toutes les complétions"], 
    ["Turn off completions globally", "Изключете завършванията глобално", "Vervollständigungen global deaktivieren", "Отключить автозаполнение глобально", "Desactivar las completaciones globalmente", "全局关闭补全", "Désactiver les complétions globalement"], 
    ["Turn on completions globally", "Включете завършванията глобално", "Vervollständigungen global aktivieren", "Включить автозаполнение глобально", "Activar las completaciones globalmente", "全局开启补全", "Activer les complétions globalement"], 
    ["Start completion llama.cpp server", "Стартиране на сървър за завършване llama.cpp", "Startet den Abschluss-Server von llama.cpp", "Запуск сервера завершения llama.cpp", "Iniciar servidor de finalización llama.cpp", "启动 llama.cpp 补全服务器", "Démarrer le serveur de complétion llama.cpp"], 
    ["Runs the command from property launch_completion", "Изпълнява командата от свойството launch_completion", "Führt den Befehl aus der Eigenschaft launch_completion aus", "Выполняет команду из свойства launch_completion", "Ejecuta el comando de la propiedad launch_completion", "执行来自 launch_completion 属性的命令", "Exécute la commande de la propriété launch_completion"], 
    ["Start chat llama.cpp server", "Стартиране на сървър за чат llama.cpp", "Startet den Chat-Server von llama.cpp", "Запуск сервера чата llama.cpp", "Iniciar servidor de chat llama.cpp", "启动 llama.cpp 聊天服务器", "Démarrer le serveur de chat llama.cpp"],
    ["Runs the command from property launch_chat", "Изпълнява командата от свойството launch_chat", "Führt den Befehl aus der Eigenschaft launch_chat aus", "Выполняет команду из свойства launch_chat", "Ejecuta el comando de la propiedad launch_chat", "执行来自 launch_chat 属性的命令", "Exécute la commande de la propriété launch_chat"], 
    ["Stop completion llama.cpp server", "Спиране на сървъра за завършване llama.cpp", "Beenden des Abschluss-Servers llama.cpp", "Остановка сервера завершения llama.cpp", "Detener el servidor de finalización llama.cpp", "停止完成 llama.cpp 服务器", "Arrêter le serveur de complétion llama.cpp"], 
    ["Stops completion llama.cpp server if it was started from llama.vscode menu", "Спира сървъра за завършване llama.cpp, ако е стартиран от менюто на llama.vscode", "Beendet den Abschluss-Server llama.cpp, wenn er aus dem Menü von llama.vscode gestartet wurde", "Останавливает сервер завершения llama.cpp, если он был запущен из меню llama.vscode", "Detiene el servidor de finalización llama.cpp si se inició desde el menú de llama.vscode", "如果从 llama.vscode 菜单启动，则停止完成 llama.cpp 服务器", "Arrête le serveur de complétion llama.cpp s'il a été démarré à partir du menu llama.vscode"], 
    ["Stop chat llama.cpp server", "Спиране на чат сървър llama.cpp", "Beenden des Chat-Servers llama.cpp", "Остановка чат-сервера llama.cpp", "Detener el servidor de chat llama.cpp", "停止聊天 llama.cpp 服务器", "Arrêter le serveur de chat llama.cpp"], 
    ["Stops chat llama.cpp server if it was started from llama.vscode menu", "Спира чат сървъра llama.cpp, ако е стартиран от менюто на llama.vscode", "Beendet den Chat-Server llama.cpp, wenn er aus dem Menü von llama.vscode gestartet wurde", "Останавливает чат-сервер llama.cpp, если он был запущен из меню llama.vscode", "Detiene el servidor de chat llama.cpp si se inició desde el menú de llama.vscode", "如果从 llama.vscode 菜单启动，则停止聊天 llama.cpp 服务器", "Arrête le serveur de chat llama.cpp s'il a été démarré à partir du menu llama.vscode"],
    ["Start completion model", "Стартиране на модела за допълнение", "Vervollständigungsmodell starten", "Запуск модели дополнения", "Iniciar modelo de completado", "启动补全模型", "Démarrer le modèle de complétion"],
    ["Start chat model", "Стартиране на модела за чат", "Chat-Modell starten", "Запуск модели чата", "Iniciar modelo de chat", "启动聊天模型", "Démarrer le modèle de chat"],
    ["Requires brew, installs/upgrades llama.cpp server, downloads the model if not available, and runs llama.cpp server", "Изисква Brew, инсталира/актуализира llama.cpp сървъра, изтегля модела, ако не е наличен и стартира llama.cpp сървъра", "Erfordert Brew, installiert/aktualisiert den llama.cpp-Server, lädt das Modell herunter, falls nicht verfügbar, und startet den llama.cpp-Server", "Требуется Brew, устанавливает/обновляет сервер llama.cpp, скачивает модель, если она недоступна, и запускает сервер llama.cpp", "Requiere Brew, instala/actualiza el servidor llama.cpp, descarga el modelo si no está disponible, y ejecuta el servidor llama.cpp", "需要 brew，安装/升级 llama.cpp 服务器，如果模型不可用则下载模型，并运行 llama.cpp 服务器", "Nécessite Brew, installe/met à jour le serveur llama.cpp, télécharge le modèle s'il n'est pas disponible, et lance le serveur llama.cpp"],
    ["Error getting response. Please check if llama.cpp server is running.", "Грешка при получаване на отговор. Моля, проверете дали сървърът на llama.cpp работи.", "Fehler beim Abrufen der Antwort. Bitte prüfen Sie, ob der llama.cpp-Server läuft.", "Ошибка при получении ответа. Пожалуйста, проверьте, запущен ли сервер llama.cpp.", "Error al obtener respuesta. Por favor, verifique si el servidor de llama.cpp está en ejecución.", "获取响应时出错。请检查llama.cpp服务器是否正在运行。", "Erreur lors de l'obtention de la réponse. Veuillez vérifier si le serveur llama.cpp est en cours d'exécution."], 
    ["llama-vscode extension is updated.", "Разширението llama-vscode е актуализирано.", "Die llama-vscode-Erweiterung ist aktualisiert.", "Расширение llama-vscode обновлено.", "La extensión llama-vscode está actualizada.", "llama-vscode扩展已更新。", "L'extension llama-vscode est mise à jour."], 
    ["There is no command to execute.", "Няма команда за изпълнение.", "Es gibt keinen Befehl zum Ausführen.", "Нет команды для выполнения.", "No hay comando para ejecutar.", "没有可执行的命令。", "Il n'y a aucune commande à exécuter."], 
    ["Error executing command", "Грешка при изпълнение на командата", "Fehler beim Ausführen des Befehls", "Ошибка выполнения команды", "Error al ejecutar el comando", "执行命令时出错", "Erreur lors de l'exécution de la commande"], 
  ];
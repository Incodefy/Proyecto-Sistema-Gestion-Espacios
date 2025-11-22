from .models import Medico, Agenda, Box, Estado, Pasillo, Especialidad, BoxInstrumento, Notificacion
from incodefy.agenda_strategy import AgendaPorBox, AgendaPorMedico
from .composite_medico import generar_especialidades_con_medicos
from django.http import JsonResponse, Http404, HttpResponse
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from .strategy_estado_medico import ContextoEstadoMedico
from django.views.decorators.cache import never_cache
from .composite_box import generar_pasillos_con_boxes
from django.views.decorators.csrf import csrf_exempt
from datetime import datetime, timedelta, date, time
from django.shortcuts import render, redirect
from channels.layers import get_channel_layer
from django.contrib.auth.models import User
from .strategy_estado import ContextoEstado
from asgiref.sync import async_to_sync
from django.contrib import messages
from .forms import ExcelUploadForm
from django.db.models import Q
from io import StringIO
import pandas as pd
import json
import uuid
import io

#login
def login_view(request):
    if request.method == 'POST':
        email = request.POST.get('email')
        password = request.POST.get('password')

        try:
            user = User.objects.get(email=email)
            user = authenticate(request, username=user.username, password=password)
            if user is not None:
                login(request, user)
                return redirect('agenda')
            else:
                messages.error(request, 'Correo o contraseña incorrectos')
        except User.DoesNotExist:
            messages.error(request, 'Correo no registrado')

    return render(request, 'login.html')


# Interfaz de agenda
@never_cache
@login_required
def agenda(request):
    return render(request, 'agenda.html')

# Agenda por box y médico
@login_required
def calendario_agenda(request, tipo):
    if tipo not in ['box', 'medico']:
        return HttpResponse("Tipo de vista no válido", status=400)

    horas = [
        "08:00 - 09:00", "09:00 - 10:00", "10:00 - 11:00", "11:00 - 12:00",
        "12:00 - 13:00", "13:00 - 14:00", "14:00 - 15:00", "15:00 - 16:00",
        "16:00 - 17:00", "17:00 - 18:00", "18:00 - 19:00", "19:00 - 20:00",
        "20:00 - 21:00", "21:00 - 22:00", "22:00 - 23:00", "23:00 - 00:00"
    ]
    dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

    context = {
        'tipo': tipo,
        'horas': horas,
        'dias': dias,
        'medicos': Medico.objects.all(),
        'boxes': Box.objects.all(),
        'pasillos': Pasillo.objects.all(),
        'especialidades': Especialidad.objects.all(),
    }

    return render(request, f'calendario_agenda.html', context)

# Obtener agendamientos por box o médico
def obtener_agendamientos(request):
    tipo = request.GET.get('tipo')

    if tipo == 'box':
        estrategia = AgendaPorBox()
    elif tipo == 'medico':
        estrategia = AgendaPorMedico()
    else:
        return JsonResponse({'error': 'Tipo inválido'}, status=400)

    return estrategia.obtener_agendamientos(request)

# Interfaz de disponibilidad de boxes
@csrf_exempt
def guardar_agenda(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        medico_id = data.get('medico_id')
        hora = data.get('hora')
        fecha_inicio = datetime.strptime(data.get('fecha_inicio'), "%Y-%m-%d")
        box_id = data.get('box_id')

        partes_hora = hora.split(" - ")
        hora_inicio = datetime.strptime(partes_hora[0], "%H:%M").time()
        hora_fin = datetime.strptime(partes_hora[1], "%H:%M").time()

        ya_existe_box = Agenda.objects.filter(
            idbox_id=box_id,
            fecha=fecha_inicio,
            horainicio__lt=hora_fin,
            horafin__gt=hora_inicio
        ).exists()

        if ya_existe_box:
            return JsonResponse({'status': 'error', 'mensaje': 'Ese horario ya está ocupado.'})
        
        ya_existe_medico = Agenda.objects.filter(
            idmedico_id=medico_id,
            fecha=fecha_inicio,
            horainicio__lt=hora_fin,
            horafin__gt=hora_inicio
        ).exists()

        if ya_existe_medico:
            return JsonResponse({'status': 'error', 'mensaje': 'El médico ya está asignado en ese horario.'})
        
        estado = Estado.objects.filter(nombre__icontains='no atendido').first()

        nueva_agenda = Agenda.objects.create(
            idmedico_id=medico_id,
            idbox_id=box_id,
            idestado=estado,
            horainicio=hora_inicio,
            horafin=hora_fin,
            fecha=fecha_inicio
        )

        return JsonResponse({'status': 'ok', 'idAgenda': nueva_agenda.idagenda})
    
    return JsonResponse({'error': 'Método no permitido'}, status=405)

@csrf_exempt
def eliminar_agenda_medico(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        
        medico_id = data.get('medico_id')
        fecha = data.get('fecha')
        hora = data.get('hora')
        box_id = data.get('box_id')

        try:
            hora_inicio, hora_fin = hora.split(" - ")
            agenda = Agenda.objects.get(
                idmedico_id=medico_id,
                fecha=fecha,
                horainicio=datetime.strptime(hora_inicio, "%H:%M").time(),
                horafin=datetime.strptime(hora_fin, "%H:%M").time(),
                idbox_id=box_id
            )
            agenda.delete()
            return JsonResponse({'status': 'ok', 'mensaje': 'Agenda eliminada'})
        except Agenda.DoesNotExist:
            return JsonResponse({'error': 'Agenda no encontrada'}, status=404)

    return JsonResponse({'error': 'Método no permitido'}, status=405)

@csrf_exempt
def eliminar_agenda_box(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        
        medico_id = data.get('medico_id')
        fecha = data.get('fecha')
        hora = data.get('hora')
        box_id = data.get('box_id')

        try:
            hora_inicio, hora_fin = hora.split(" - ")
            agenda = Agenda.objects.get(
                idmedico_id=medico_id,
                fecha=fecha,
                horainicio=datetime.strptime(hora_inicio, "%H:%M").time(),
                horafin=datetime.strptime(hora_fin, "%H:%M").time(),
                idbox_id=box_id
            )
            agenda.delete()
            return JsonResponse({'status': 'ok'})
        except Agenda.DoesNotExist:
            return JsonResponse({'status': 'error', 'mensaje': 'Agendamiento no encontrado.'})
    return JsonResponse({'status': 'error', 'mensaje': 'Método no permitido.'})

def expandir_rangos(texto):
    if not texto:
        return None
    resultado = set()
    for parte in texto.split(','):
        if '-' in parte:
            inicio, fin = parte.split('-')
            try:
                for i in range(int(inicio), int(fin) + 1):
                    resultado.add(i)
            except ValueError:
                continue
        else:
            try:
                resultado.add(int(parte))
            except ValueError:
                continue
    return sorted(resultado)

@login_required
def box(request):
    filtro_pasillo = expandir_rangos(request.GET.get("pasillo"))
    filtro_box = expandir_rangos(request.GET.get("box"))
    filtro_estado = request.GET.get("estado")

    hoy = date.today()
    hora_actual = datetime.now().time()

    pasillos = Pasillo.objects.all().order_by('idpasillo')
    boxes = Box.objects.all()
    agendas = Agenda.objects.all()

    pasillo_box_map = generar_pasillos_con_boxes(
        pasillos, boxes, agendas,
        filtro_pasillo, filtro_box, filtro_estado,
        hoy, hora_actual
    )

    return render(request, 'box.html', {'pasillo_box_map': pasillo_box_map})

# Obtener el estado de los boxes
@csrf_exempt
def estado_boxes(request):
    hoy = date.today()
    hora_actual = datetime.now().time()
    contexto = ContextoEstado()

    data = {}
    for box in Box.objects.all().select_related('idpasillo'):
        estado = contexto.obtener_estado(box, hoy, hora_actual)
        data[box.idbox] = {
            'estado': estado.nombre,
            'medico': estado.medico,
            'especialidad': estado.especialidad,
            'consulta_actual': estado.consulta_actual,
            'proxima_consulta': estado.proxima_consulta,
            'inhabilitado': box.estado == 0
        }

    return JsonResponse(data)

@csrf_exempt
def estado_boxes_batch(request):
    hoy = date.today()
    hora_actual = datetime.now().time()
    contexto = ContextoEstado()

    try:
        body = json.loads(request.body)
        box_ids = body.get('box_ids', [])
    except Exception:
        return JsonResponse({'error': 'Formato inválido'}, status=400)

    if not box_ids:
        return JsonResponse({'error': 'Debe proporcionar box_ids'}, status=400)

    data = {}

    boxes = Box.objects.filter(idbox__in=box_ids).select_related('idpasillo')
    for box in boxes:
        estado = contexto.obtener_estado(box, hoy, hora_actual)
        data[box.idbox] = {
            'estado': estado.nombre,
            'medico': estado.medico,
            'especialidad': estado.especialidad,
            'consulta_actual': estado.consulta_actual,
            'proxima_consulta': estado.proxima_consulta,
            'inhabilitado': box.estado == 0
        }

    return JsonResponse(data)

# Interfaz de detalle de box
@login_required
def box_detail(request, boxid):
    try:
        box = Box.objects.get(idbox=boxid)
    except Box.DoesNotExist:
        raise Http404("Box no encontrado")
    
    hoy = date.today()
    
    instrumentos = BoxInstrumento.objects.filter(idbox=box).select_related('idinstrumento')
    
    context = {
        "nombre": box.nombre,
        "idpasillo": box.idpasillo.idpasillo,
        'box_id': box.idbox,
        "fecha_str": hoy.strftime("%Y-%m-%d"),
        "estado": "Inhabilitado" if box.estado == 0 else "Habilitado" if box.estado == 1 else "Desconocido",
        "instrumentos": instrumentos
    }
    return render(request, 'box_detail.html', context)

# Obtener información del box
def obtener_info_box(request):
    box_id = request.GET.get("box_id")
    fecha_str = request.GET.get("fecha")
    
    if not box_id or not fecha_str:
        return JsonResponse({"error": "Faltan parámetros"}, status=400)

    try:
        fecha = datetime.strptime(fecha_str, "%Y-%m-%d").date()
        box = Box.objects.select_related('idpasillo').get(pk=box_id)
    except Exception:
        return JsonResponse({"error": "Datos inválidos"}, status=400)

    agendas = Agenda.objects.filter(idbox=box, fecha=fecha).select_related('idmedico', 'idestado')

    horas_disponibles = [
        "08:00 - 09:00", "09:00 - 10:00", "10:00 - 11:00", "11:00 - 12:00",
        "12:00 - 13:00", "13:00 - 14:00", "14:00 - 15:00", "15:00 - 16:00",
        "16:00 - 17:00", "17:00 - 18:00", "18:00 - 19:00", "19:00 - 20:00",
        "20:00 - 21:00", "21:00 - 22:00", "22:00 - 23:00", "23:00 - 00:00"
    ]
    tabla_horaria = {hora: "" for hora in horas_disponibles}

    for agenda in agendas:
        if agenda.horainicio:
            inicio = agenda.horainicio.strftime("%H:%M")
            fin = (datetime.combine(fecha, agenda.horainicio) + timedelta(hours=1)).strftime("%H:%M")
            bloque = f"{inicio} - {fin}"
            if bloque in tabla_horaria:
                tabla_horaria[bloque] = {
                    "medico": agenda.idmedico.nombre if agenda.idmedico else "",
                    "especialidad": agenda.idmedico.idespecialidad.nombre if agenda.idmedico.idespecialidad.nombre else "",
                    "estado": agenda.idestado.nombre if agenda.idestado else "",
                    "tipo_consulta": agenda.tipoconsulta if agenda.tipoconsulta else "",
                }

    total_consultas = agendas.count()
    consultas_no_realizadas = agendas.filter(idestado__nombre="No atendido").count()
    consultas_realizadas = total_consultas - consultas_no_realizadas
    uso_box = round((total_consultas / len(horas_disponibles)) * 100) if horas_disponibles else 0
    cumplimiento = round((consultas_realizadas / total_consultas) * 100) if total_consultas > 0 else 0
    
    return JsonResponse({
        "fecha": fecha.strftime("%d %B %Y"),
        "horarios": tabla_horaria,
        "total_consultas": total_consultas,
        "consultas_no_realizadas": consultas_no_realizadas,
        "uso_box": uso_box,
        "cumplimiento": cumplimiento
    })


#excel
def clasificar_conflicto_fila(df, fila_idx):
    df = df.reset_index(drop=True)
    
    row = df.loc[fila_idx]
    fecha = row["fecha"]
    hora_ini = row["horainicio"]
    hora_fin = row["horafin"]
    box = str(row["box"]).strip()
    medico = str(row["medico"]).strip()

    conflicto_interno = (
        df[
            (df.index != fila_idx) &
            (df["fecha"] == fecha) &
            (df["horainicio"] < hora_fin) &
            (df["horafin"] > hora_ini) & (
                ((df["box"].astype(str).str.strip() == box) &
                 (df["medico"].astype(str).str.strip() != medico)) |
                ((df["medico"].astype(str).str.strip() == medico) &
                 (df["box"].astype(str).str.strip() != box))
            )
        ].shape[0] > 0
    )
    
    conflicto_bd = Agenda.objects.filter(
        fecha=fecha
    ).filter(
        Q(idbox__nombre__iexact=box) | Q(idmedico__nombre__iexact=medico)
    ).filter(
        Q(horainicio__lt=hora_fin) & Q(horafin__gt=hora_ini)
    ).exists()
    
    if conflicto_interno and conflicto_bd:
        return "ambos"
    elif conflicto_interno:
        return "interno"
    elif conflicto_bd:
        return "base"
    else:
        return "ninguno"

def importar_consultas(request):
    form = ExcelUploadForm()
    fechas_info = []
    total_consultas = 0
    sobreposiciones = {"filas": 0}
    resaltadas_dict = {}
    fechas_resaltadas = {}

    if request.method == 'POST' and 'archivo' in request.FILES:
        form = ExcelUploadForm(request.POST, request.FILES)
        if form.is_valid():
            archivo = request.FILES['archivo']
            try:
                df = pd.read_excel(archivo)

                df['fecha'] = pd.to_datetime(df['fecha'], errors='coerce').dt.date
                df['horainicio'] = pd.to_datetime(df['horainicio'].astype(str), format='%H:%M:%S', errors='coerce').dt.time
                df['horafin'] = pd.to_datetime(df['horafin'].astype(str), format='%H:%M:%S', errors='coerce').dt.time
                df = df.dropna(subset=['fecha', 'horainicio', 'horafin'])

                df['idfila'] = [str(uuid.uuid4()) for _ in range(len(df))]
                # Clasificar tipo de conflicto
                
                df["conflicto_tipo"] = df.index.map(lambda i: clasificar_conflicto_fila(df, i))

                sobreposiciones['filas'] = df[df["conflicto_tipo"] != "ninguno"].shape[0]
                total_consultas = len(df)

                request.session['df_excel'] = df.to_json(date_format='iso')

                fechas_info = sorted(df['fecha'].dropna().unique())
                for fecha in fechas_info:
                    tiene_conflictos = df[(df['fecha'] == fecha) & (df["conflicto_tipo"] != "ninguno")].shape[0] > 0
                    resaltadas_dict[str(fecha)] = 1 if tiene_conflictos else 0

                fechas_resaltadas = resaltadas_dict
                
            except Exception as e:
                return render(request, 'importar_consultas.html', {
                    'form': form,
                    'error': str(e),
                })

    return render(request, 'importar_consultas.html', {
        'form': form,
        'total_consultas': total_consultas,
        'sobreposiciones': sobreposiciones,
        'fechas_resaltadas': fechas_resaltadas
    })
    
def obtener_filtros_por_fecha(request):
    fechas = request.GET.get('fechas')
    df_json = request.session.get('df_excel')
    
    if not df_json or not fechas:
        return JsonResponse({'boxes': [], 'medicos': [], 'tipos': [], 'estados': []})

    try:
        df = pd.read_json(StringIO(df_json))
        df['fecha'] = pd.to_datetime(df['fecha'], errors='coerce').dt.date

        fechas_lista = [pd.to_datetime(f, errors='coerce').date() for f in fechas.split(',')]
        df_filtrado = df[df['fecha'].isin(fechas_lista)]

        # Normalización
        df_filtrado['box'] = df_filtrado['box'].astype(str).str.strip()
        df_filtrado['medico'] = df_filtrado['medico'].astype(str).str.strip()
        df_filtrado['tipoconsulta'] = df_filtrado['tipoconsulta'].astype(str).str.strip()
        df_filtrado['estado'] = df_filtrado['estado'].astype(str).str.strip()

        return JsonResponse({
            'boxes': sorted(df_filtrado['box'].dropna().unique()),
            'medicos': sorted(df_filtrado['medico'].dropna().unique()),
            'tipos': sorted(df_filtrado['tipoconsulta'].dropna().unique()),
            'estados': sorted(df_filtrado['estado'].dropna().unique()),
        })

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def obtener_consultas_filtradas(request):
    if request.method == 'POST':
        tipo = request.POST.get('tipo')
        valor = request.POST.get('valor')
        fechas = request.POST.getlist('fechas[]')
        df_json = request.session.get('df_excel')
                
        if not df_json:
            return JsonResponse({'error': 'No hay datos cargados'}, status=400)

        try:
            df = pd.read_json(StringIO(df_json))
            
            df['fecha'] = pd.to_datetime(df['fecha'], errors='coerce').dt.date
            df["horainicio"] = pd.to_datetime(df["horainicio"], format="%H:%M:%S", errors="coerce").dt.time
            df["horafin"] = pd.to_datetime(df["horafin"], format="%H:%M:%S", errors="coerce").dt.time
             
            # Aplicar filtros por fechas
            fechas = [pd.to_datetime(f).date() for f in fechas]
            df = df[df['fecha'].isin(fechas)]
                        
            # Filtros principales
            if tipo == 'box':
                df = df[df['box'].astype(str).str.strip() == valor]
            elif tipo == 'medico':
                df = df[df['medico'].astype(str).str.strip() == valor]

            # Filtros de exclusión
            excluir_box = request.POST.getlist("excluir_box[]")
            excluir_medico = request.POST.getlist("excluir_medico[]")
            excluir_tipoconsulta = request.POST.getlist("excluir_tipoconsulta[]")
            excluir_estado = request.POST.getlist("excluir_estado[]")
            
            if excluir_box:
                df = df[~df['box'].astype(str).isin(excluir_box)]
            if excluir_medico:
                df = df[~df['medico'].astype(str).isin(excluir_medico)]
            if excluir_tipoconsulta:
                df = df[~df['tipoconsulta'].astype(str).isin(excluir_tipoconsulta)]
            if excluir_estado:
                df = df[~df['estado'].astype(str).isin(excluir_estado)]

            df = df.reset_index(drop=True)
            
            pagina = request.POST.get("pagina", "")
            if pagina.endswith("importar-consultas/"):
                df["conflicto_tipo"] = df.index.map(lambda i: clasificar_conflicto_fila(df, i))
            elif pagina.endswith("exportar-consultas/"):
                df["conflicto_tipo"] = df.index.map(lambda i: clasificar_conflicto_db(df, i))

            data = df.sort_values(by=['fecha', 'horainicio']).to_dict(orient='records')
            
            return JsonResponse({'consultas': data})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)

    return JsonResponse({'error': 'Método no permitido'}, status=405)

@csrf_exempt
def obtener_fechas_resaltadas(request):
    df_json = request.session.get('df_excel')
    if not df_json:
        return JsonResponse({'resaltadas': {}})

    try:
        df = pd.read_json(StringIO(df_json))
                
        df['fecha'] = pd.to_datetime(df['fecha']).dt.date
        
        resaltadas_dict = {}

        for fecha in sorted(df['fecha'].dropna().unique()):
            tiene_conflicto = df[
                (df['fecha'] == fecha) &
                (df['conflicto_tipo'].isin(['interno', 'base', 'ambos']))
            ].shape[0] > 0
            resaltadas_dict[str(fecha)] = 1 if tiene_conflicto else 0
            
        return JsonResponse({'resaltadas': resaltadas_dict})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
def obtener_cantidad_sobreposiciones(request):
    df_json = request.session.get("df_excel")
    if not df_json:
        return JsonResponse({"filas": 0})

    try:
        df = pd.read_json(StringIO(df_json))
        cantidad = df[df["conflicto_tipo"].isin(["interno", "base", "ambos"])].shape[0]
        return JsonResponse({"filas": int(cantidad)})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
    
@csrf_exempt
def obtener_total_consultas(request):
    df_json = request.session.get("df_excel")
    if not df_json:
        return JsonResponse({"total": 0})

    try:
        df = pd.read_json(StringIO(df_json))
        df['fecha'] = pd.to_datetime(df['fecha']).dt.date

        fechas = request.GET.getlist("fechas[]", [])
        tipo = request.GET.get("tipo")
        valor = request.GET.get("valor")

        fechas = [pd.to_datetime(f).date() for f in fechas]
        df = df[df['fecha'].isin(fechas)]

        if tipo == "box":
            df = df[df['box'].astype(str).str.strip() == valor]
        elif tipo == "medico":
            df = df[df['medico'].astype(str).str.strip() == valor]

        return JsonResponse({ "total": len(df) })

    except Exception as e:
        return JsonResponse({ "error": str(e) }, status=500)
    
@csrf_exempt
def actualizar_df_excel(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            eliminados = data.get("eliminados", [])
            df_json = request.session.get("df_excel")
            
            if not df_json:
                return JsonResponse({"status": "error", "mensaje": "No hay datos en sesión."})

            df = pd.read_json(StringIO(df_json))
            
            df["fecha"] = pd.to_datetime(df["fecha"]).dt.date
            df["horainicio"] = pd.to_datetime(df["horainicio"], format="%H:%M:%S", errors="coerce").dt.time
            df["horafin"] = pd.to_datetime(df["horafin"], format="%H:%M:%S", errors="coerce").dt.time

            if eliminados:
                df = df[~df["idfila"].isin(eliminados)]

            request.session["df_excel"] = df.to_json(date_format="iso")
            
            return JsonResponse({"status": "ok"})
        except Exception as e:
            return JsonResponse({"status": "error", "mensaje": str(e)})

@csrf_exempt
def analizar_conflictos_local(request):
    try:
        body = json.loads(request.body)
        consultas = body.get("consultas", [])
        df = pd.DataFrame(consultas)

        df["fecha"] = pd.to_datetime(df["fecha"]).dt.date
        df["horainicio"] = pd.to_datetime(df["horainicio"], format="%H:%M:%S", errors="coerce").dt.time
        df["horafin"] = pd.to_datetime(df["horafin"], format="%H:%M:%S", errors="coerce").dt.time

        pagina = body.get("pagina", "")

        if pagina.endswith("importar-consultas/"):
            df["conflicto_tipo"] = df.index.map(lambda i: clasificar_conflicto_fila(df, i))
        elif pagina.endswith("exportar-consultas/"):
            df["conflicto_tipo"] = df.index.map(lambda i: clasificar_conflicto_db(df, i))

        return JsonResponse({"status": "ok", "consultas": df.to_dict(orient="records")})
    except Exception as e:
        return JsonResponse({"status": "error", "mensaje": str(e)}, status=500)

@csrf_exempt
def analizar_sobreposicion(request):
    df_json = request.session.get("df_excel")
    if not df_json:
        return JsonResponse({"status": "error", "mensaje": "No se encontró el dataframe en sesión."})

    try:
        df = pd.read_json(StringIO(df_json))
        
        df['fecha'] = pd.to_datetime(df['fecha']).dt.date
        df["horainicio"] = pd.to_datetime(df["horainicio"], format="%H:%M:%S", errors="coerce").dt.time
        df["horafin"] = pd.to_datetime(df["horafin"], format="%H:%M:%S", errors="coerce").dt.time

        df = df.reset_index(drop=True)
        
        conflictos = []
        
        pagina = request.POST.get("pagina", "")
        if pagina.endswith('importar_consultas'):
            for idx in df.index:
                tipo_conflicto = clasificar_conflicto_fila(df, idx)
                conflictos.append(tipo_conflicto)
        elif pagina.endswith('exportar_consultas'):
            for idx in df.index:
                tipo_conflicto = clasificar_conflicto_db(df, idx)
                conflictos.append(tipo_conflicto)
        else:
            conflictos = ["ninguno"] * len(df)

        df["conflicto_tipo"] = conflictos
        
        request.session["df_excel"] = df.to_json(date_format="iso")

        return JsonResponse({
            "status": "ok",
            "consultas": json.loads(df.to_json(orient="records", date_format='iso'))
        })

    except Exception as e:
        return JsonResponse({
            "status": "error",
            "mensaje": str(e)
        }, status=500)
        
@csrf_exempt
def guardar_consultas_finales(request):
    if request.method == 'POST':
        try:
            body = json.loads(request.body)
            consultas = body.get('consultas', [])

            if not consultas:
                return JsonResponse({"status": "error", "mensaje": "No se recibieron consultas."})

            for c in consultas:
                box_nombre = str(c['box']).strip()
                medico_nombre = str(c['medico']).strip()
                estado_nombre = str(c['estado']).strip()

                box_obj, _ = Box.objects.get_or_create(nombre=box_nombre)
                medico_obj, _ = Medico.objects.get_or_create(nombre=medico_nombre)
                estado_obj, _ = Estado.objects.get_or_create(nombre=estado_nombre)

                Agenda.objects.create(
                    idmedico = medico_obj,
                    idbox = box_obj,
                    idestado = estado_obj,
                    fecha = pd.to_datetime(c['fecha']).date(),
                    horainicio = pd.to_datetime(c['horainicio'], format="%H:%M:%S").time(),
                    horafin = pd.to_datetime(c['horafin'], format="%H:%M:%S").time(),
                    tipoconsulta = str(c['tipoconsulta']).strip() if c.get('tipoconsulta') else None
                )
                
            channel_layer = get_channel_layer()
            
            Notificacion.objects.create(
                tipo="importacion",
                mensaje=f"Se han importado {len(consultas)} consultas.",
                detalle=consultas
            )
            
            async_to_sync(channel_layer.group_send)(
                "notificaciones",
                {
                    "type": "nueva_importacion",
                    "mensaje": f"Se han importado {len(consultas)} consultas.",
                    "detalle": consultas
                }
            )
            
            return JsonResponse({"status": "ok", "mensaje": f"Se guardaron {len(consultas)} consultas."})

        except Exception as e:
            return JsonResponse({"status": "error", "mensaje": str(e)}, status=500)

    return JsonResponse({"status": "error", "mensaje": "Método no permitido"}, status=405)

#exportar consultas
def clasificar_conflicto_db(df, fila_idx):
    df = df.reset_index(drop=True)
    
    row = df.loc[fila_idx]
    fecha = row["fecha"]
    hora_ini = row["horainicio"]
    hora_fin = row["horafin"]
    box = str(row["box"]).strip()
    medico = str(row["medico"]).strip()

    conflicto_interno = (
        df[
            (df.index != fila_idx) &
            (df["fecha"] == fecha) &
            (df["horainicio"] < hora_fin) &
            (df["horafin"] > hora_ini) & (
                ((df["box"].astype(str).str.strip() == box) &
                 (df["medico"].astype(str).str.strip() != medico)) |
                ((df["medico"].astype(str).str.strip() == medico) &
                 (df["box"].astype(str).str.strip() != box))
            )
        ].shape[0] > 0
    )
    if conflicto_interno:
        return "interno"
    else:
        return "ninguno"

def exportar_consultas(request):
    fechas_info = []
    total_consultas = 0
    sobreposiciones = {"filas": 0}
    resaltadas_dict = {}
    fechas_resaltadas = {}

    try:
        consultas = Agenda.objects.select_related('idmedico', 'idbox', 'idestado').all()

        df = pd.DataFrame(list(consultas.values(
            'idmedico__nombre',
            'idbox__nombre',
            'idestado__nombre',
            'horainicio',
            'horafin',
            'fecha',
            'tipoconsulta'
        )))

        if df.empty:
            df['fecha'] = pd.NaT
            df['horainicio'] = pd.NaT
            df['horafin'] = pd.NaT
            df['idmedico__nombre'] = ""
            df['idbox__nombre'] = ""
            df['idestado__nombre'] = ""
            df['tipoconsulta'] = ""

        df = df.rename(columns={
            'idmedico__nombre': 'medico',
            'idbox__nombre': 'box',
            'idestado__nombre': 'estado',
            'tipoconsulta': 'tipoconsulta'
        })
        
        df['fecha'] = pd.to_datetime(df['fecha'], errors='coerce').dt.date
        df['horainicio'] = pd.to_datetime(df['horainicio'].astype(str), format='%H:%M:%S', errors='coerce').dt.time
        df['horafin'] = pd.to_datetime(df['horafin'].astype(str), format='%H:%M:%S', errors='coerce').dt.time
        df = df.dropna(subset=['fecha', 'horainicio', 'horafin'])

        df['idfila'] = [str(uuid.uuid4()) for _ in range(len(df))]

        df['conflicto_tipo'] = df.index.map(lambda i: clasificar_conflicto_db(df, i))

        sobreposiciones['filas'] = df[df['conflicto_tipo'] != 'ninguno'].shape[0]
        total_consultas = len(df)

        request.session['df_excel'] = df.to_json(date_format='iso')

        fechas_info = sorted(df['fecha'].dropna().unique())
        for fecha in fechas_info:
            tiene_conflictos = df[(df['fecha'] == fecha) & (df['conflicto_tipo'] != 'ninguno')].shape[0] > 0
            resaltadas_dict[str(fecha)] = 1 if tiene_conflictos else 0

        fechas_resaltadas = resaltadas_dict

    except Exception as e:
        return render(request, 'exportar_consultas.html', {
            'error': str(e),
            'total_consultas': total_consultas,
            'sobreposiciones': sobreposiciones,
            'fechas_resaltadas': fechas_resaltadas
        })

    return render(request, 'exportar_consultas.html', {
        'total_consultas': total_consultas,
        'sobreposiciones': sobreposiciones,
        'fechas_resaltadas': fechas_resaltadas
    })

@csrf_exempt
def exportar_consultas_excel(request):
    if request.method == "POST":
        try:
            body = json.loads(request.body)
            consultas = body.get("consultas", [])

            if not consultas:
                return JsonResponse({"status": "error", "mensaje": "No se recibieron consultas."}, status=400)

            df = pd.DataFrame(consultas)

            columnas = [
                "fecha", "horainicio", "horafin",
                "box", "medico", "tipoconsulta", "estado"
            ]
            columnas_presentes = [col for col in columnas if col in df.columns]
            df = df[columnas_presentes]

            df = df.astype(str)

            output = io.BytesIO()
            with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
                df.to_excel(writer, index=False, sheet_name='Consultas')

            output.seek(0)

            response = HttpResponse(
                output,
                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
            response['Content-Disposition'] = 'attachment; filename=consultas_exportadas.xlsx'

            return response

        except Exception as e:
            return JsonResponse({"status": "error", "mensaje": str(e)}, status=500)

    else:
        return JsonResponse({"status": "error", "mensaje": "Método no permitido"}, status=405)





#Notificaciones

@login_required
def historial_notificaciones_view(request):
    return render(request, 'historial_notificaciones.html')

@login_required
def notificaciones_usuario(request):
    notificaciones = Notificacion.objects.all().order_by('-fecha')[:50]

    data = [{
        'fecha': n.fecha.strftime('%Y-%m-%d %H:%M:%S'),
        'mensaje': n.mensaje,
        'detalle': n.detalle
    } for n in notificaciones]

    return JsonResponse({'notificaciones': data})



#medico

@login_required
def medico(request):
    filtro_especialidad = request.GET.get("especialidad")
    filtro_medico = request.GET.get("medico")
    filtro_estado = request.GET.get("estado")
    
    hoy = date.today()
    hora_actual = datetime.now().time()

    especialidades = Especialidad.objects.all().order_by('idespecialidad')
    medicos = Medico.objects.all()
    agendas = Agenda.objects.all()

    especialidad_medico_map = generar_especialidades_con_medicos(
        especialidades, medicos, agendas,
        filtro_especialidad, filtro_medico, filtro_estado,
        hoy, hora_actual
    )

    return render(request, 'medico.html', {'especialidad_medico_map': especialidad_medico_map})


@login_required
def estado_medicos(request):
    hoy = date.today()
    hora_actual = datetime.now().time()
    contexto = ContextoEstadoMedico()

    data = {}
    for medico in Medico.objects.all().select_related('idespecialidad'):
        estado = contexto.obtener_estado(medico, hoy, hora_actual)
        data[medico.idmedico] = {
            'estado': estado.nombre,
            'box': estado.box,
            'pasillo': estado.pasillo,
            'consulta_actual': estado.consulta_actual,
            'proxima_consulta': estado.proxima_consulta,
            'inhabilitado': False 
        }

    return JsonResponse(data)



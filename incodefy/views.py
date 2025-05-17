from .models import Medico, Agenda, Box, Estado, Pasillo, Especialidad
from incodefy.agenda_strategy import AgendaPorBox, AgendaPorMedico
from django.http import JsonResponse, Http404, HttpResponse
from .composite_box import generar_pasillos_con_boxes
from django.views.decorators.csrf import csrf_exempt
from datetime import datetime, timedelta, date, time
from .strategy_estado import ContextoEstado
from django.shortcuts import render
import json

# Interfaz de agenda
def agenda(request):
    return render(request, 'agenda.html')

# Agenda por box y médico
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

# Filtro
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

# Interfaz de disponibilidad de boxes
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


# Interfaz de detalle de box
def box_detail(request, boxid):
    try:
        box = Box.objects.get(idbox=boxid)
    except Box.DoesNotExist:
        raise Http404("Box no encontrado")
    
    hoy = date.today()
    context = {
        "nombre": box.nombre,
        "idpasillo": box.idpasillo.idpasillo,
        'box_id': box.idbox,
        "fecha_str": hoy.strftime("%Y-%m-%d"),
        "estado": "Inhabilitado" if box.estado == 0 else "Habilitado" if box.estado == 1 else "Desconocido"

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
            fin = (datetime.combine(date.today(), agenda.horainicio) + timedelta(hours=1)).strftime("%H:%M")
            bloque = f"{inicio} - {fin}"
            if bloque in tabla_horaria:
                tabla_horaria[bloque] = agenda.idmedico.nombre

    total_consultas = agendas.count()
    consultas_no_realizadas = agendas.filter(idestado__nombre="No atendido").count()
    consultas_realizadas = total_consultas - consultas_no_realizadas
    uso_box = round((consultas_realizadas / len(horas_disponibles)) * 100) if horas_disponibles else 0
    cumplimiento = round((consultas_realizadas / total_consultas) * 100) if total_consultas > 0 else 0
    
    return JsonResponse({
        "fecha": fecha.strftime("%d %B %Y"),
        "horarios": tabla_horaria,
        "total_consultas": total_consultas,
        "consultas_no_realizadas": consultas_no_realizadas,
        "uso_box": uso_box,
        "cumplimiento": cumplimiento
    })
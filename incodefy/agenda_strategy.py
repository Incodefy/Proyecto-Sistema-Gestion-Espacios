from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from django.http import JsonResponse
from incodefy.models import Agenda

class AgendaStrategy(ABC):
    @abstractmethod
    def obtener_agendamientos(self, request):
        pass

class AgendaPorBox(AgendaStrategy):
    def obtener_agendamientos(self, request):
        print("obtener_agendamientos")
        box_id = request.GET.get('box_id')
        fecha_inicio = request.GET.get('fecha_inicio')

        if not box_id or not fecha_inicio:
            return JsonResponse({'error': 'Faltan datos'}, status=400)

        try:
            fecha_inicio = datetime.strptime(fecha_inicio, "%Y-%m-%d").date()
        except ValueError:
            return JsonResponse({'error': 'Formato de fecha inválido'}, status=400)

        fecha_fin = fecha_inicio + timedelta(days=6)

        agendamientos = Agenda.objects.filter(
            idbox_id=box_id,
            fecha__range=(fecha_inicio, fecha_fin)
        )

        eventos = [{
            'medico': ag.idmedico.nombre if ag.idmedico else "Desconocido",
            'medico_id': ag.idmedico.idmedico if ag.idmedico else None,
            'hora_inicio': ag.horainicio.strftime("%H:%M"),
            'hora_fin': ag.horafin.strftime("%H:%M"),
            'fecha': ag.fecha.strftime("%Y-%m-%d"),
        } for ag in agendamientos]

        return JsonResponse({'agendas': eventos})

class AgendaPorMedico(AgendaStrategy):
    def obtener_agendamientos(self, request):
        medico_id = request.GET.get('medico_id')
        fecha_inicio = request.GET.get('fecha_inicio')

        if not medico_id or not fecha_inicio:
            return JsonResponse({'error': 'Faltan datos'}, status=400)

        try:
            fecha_inicio = datetime.strptime(fecha_inicio, "%Y-%m-%d")
        except ValueError:
            return JsonResponse({'error': 'Formato de fecha inválido'}, status=400)

        fecha_fin = fecha_inicio + timedelta(days=6)

        agendamientos = Agenda.objects.filter(
            idmedico_id=medico_id,
            fecha__range=(fecha_inicio.date(), fecha_fin.date())
        )

        eventos = [{
            'box_id': ag.idbox.idbox if ag.idbox else None,
            'box_nombre': ag.idbox.nombre if ag.idbox else "Sin nombre",
            'hora_inicio': ag.horainicio.strftime("%H:%M"),
            'hora_fin': ag.horafin.strftime("%H:%M"),
            'fecha': ag.fecha.strftime("%Y-%m-%d"),
        } for ag in agendamientos]

        return JsonResponse({'agendas': eventos})

from abc import ABC, abstractmethod
from datetime import time
from .models import Agenda

class EstrategiaEstado(ABC):
    @abstractmethod
    def calcular_estado(self, box, fecha, hora_actual):
        pass

class EstadoBox:
    def __init__(self, nombre, medico='', especialidad='', consulta_actual='', proxima_consulta=''):
        self.nombre = nombre
        self.medico = medico
        self.especialidad = especialidad
        self.consulta_actual = consulta_actual
        self.proxima_consulta = proxima_consulta

class EstadoInhabilitado(EstrategiaEstado):
    def calcular_estado(self, box, fecha, hora_actual):
        return EstadoBox(nombre='Inhabilitado')

class EstadoConConsulta(EstrategiaEstado):
    def calcular_estado(self, box, fecha, hora_actual):
        consultas = Agenda.objects.filter(
            idbox=box,
            fecha=fecha,
            horainicio__lte=hora_actual
        ).select_related('idmedico', 'idmedico__idespecialidad')

        for consulta in consultas:
            horafin = consulta.horafin or time(23, 59, 59)
            if horafin > hora_actual:
                return EstadoBox(
                    nombre='En uso',
                    medico=consulta.idmedico.nombre,
                    especialidad=consulta.idmedico.idespecialidad.nombre,
                    consulta_actual=consulta.horainicio.strftime('%H:%M')
                )
        return None

class EstadoLibre(EstrategiaEstado):
    def calcular_estado(self, box, fecha, hora_actual):
        proxima = Agenda.objects.filter(
            idbox=box,
            fecha=fecha,
            horainicio__gt=hora_actual
        ).order_by('horainicio').select_related('idmedico', 'idmedico__idespecialidad').first()

        if proxima:
            return EstadoBox(
                nombre='Libre',
                medico=proxima.idmedico.nombre,
                especialidad=proxima.idmedico.idespecialidad.nombre,
                proxima_consulta=proxima.horainicio.strftime('%H:%M')
            )
        else:
            return EstadoBox(
                nombre='Libre',
                proxima_consulta="No hay próximas consultas hoy"
            )

class ContextoEstado:
    def __init__(self):
        self.estrategia = None

    def set_estrategia(self, estrategia: EstrategiaEstado):
        self.estrategia = estrategia

    def obtener_estado(self, box, fecha, hora_actual):
        if box.estado == 0:
            self.set_estrategia(EstadoInhabilitado())
            return self.estrategia.calcular_estado(box, fecha, hora_actual)

        self.set_estrategia(EstadoConConsulta())
        estado = self.estrategia.calcular_estado(box, fecha, hora_actual)

        if estado is None:
            self.set_estrategia(EstadoLibre())
            estado = self.estrategia.calcular_estado(box, fecha, hora_actual)

        return estado

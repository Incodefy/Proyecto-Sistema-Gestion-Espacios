from abc import ABC, abstractmethod
from collections import OrderedDict

class BoxLeaf:
    def __init__(self, idbox, nombre, estado):
        self.id = idbox
        self.nombre = nombre
        self.estado = estado

    def mostrar_info(self):
        return {
            "id": self.id,
            "nombre": self.nombre,
            "estado": self.estado
        }

class PasilloComposite:
    def __init__(self, idpasillo, nombre):
        self.id = idpasillo
        self.nombre = nombre
        self.boxes = []

    def agregar_box(self, box_component):
        self.boxes.append(box_component)

    def mostrar_info(self):
        return {
            "nombre": self.nombre,
            "boxes": [box.mostrar_info() for box in self.boxes]
        }

def generar_pasillos_con_boxes(pasillos, boxes, agendas, filtro_pasillo, filtro_box, filtro_estado, hoy, hora_actual):
    resultado = OrderedDict()

    for pasillo in pasillos:
        if filtro_pasillo and pasillo.idpasillo not in filtro_pasillo:
            continue

        pasillo_compuesto = PasilloComposite(pasillo.idpasillo, pasillo.nombre)
        boxes_filtrados = boxes.filter(idpasillo=pasillo).order_by("idbox")

        for box in boxes_filtrados:
            if filtro_box and box.idbox not in filtro_box:
                continue

            estado = 'Inhabilitado' if box.estado == 0 else 'Libre'

            if box.estado != 0:
                consultas = agendas.filter(
                    idbox=box,
                    fecha=hoy,
                    horainicio__lte=hora_actual
                ).select_related("idmedico", "idmedico__idespecialidad")

                for consulta in consultas:
                    horafin = consulta.horafin or hora_actual.replace(hour=23, minute=59, second=59)
                    if horafin > hora_actual:
                        estado = 'En uso'
                        break

            if filtro_estado and estado.replace(" ", "-").lower() != filtro_estado:
                continue

            pasillo_compuesto.agregar_box(BoxLeaf(box.idbox, box.nombre or f"Box {box.idbox}", estado))

        if pasillo_compuesto.boxes:
            resultado[pasillo] = pasillo_compuesto.boxes

    return resultado

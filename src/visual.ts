/*
*  Power BI Visual CLI
*
*  Copyright (c) Microsoft Corporation
*  All rights reserved.
*  MIT License
*
*  Permission is hereby granted, free of charge, to any person obtaining a copy
*  of this software and associated documentation files (the ""Software""), to deal
*  in the Software without restriction, including without limitation the rights
*  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
*  copies of the Software, and to permit persons to whom the Software is
*  furnished to do so, subject to the following conditions:
*
*  The above copyright notice and this permission notice shall be included in
*  all copies or substantial portions of the Software.
*
*  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
*  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
*  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
*  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
*  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
*  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
*  THE SOFTWARE.
*/

"use strict";
import "core-js/stable";
import "./../style/visual.less";
import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import DataView = powerbi.DataView;
import VisualObjectInstanceEnumerationObject = powerbi.VisualObjectInstanceEnumerationObject;

import { VisualSettings } from "./settings";
import * as d3 from "d3";

interface BarChartViewModel{
    dataPoints:BarChartDataPoint[],
    dataMax:number,
    settings:BarChartSettings
}
interface BarChartSettings{
    enableAxis:{
        show:boolean;
    }
}
interface BarChartDataPoint{
    value:number;
    category:string;
    color:string;
    selectionID:powerbi.extensibility.ISelectionId;
}
export class Visual implements IVisual {  
    
    
    private svg: d3.Selection<SVGElement, {}, HTMLElement, any>;
    private barContainer: d3.Selection<SVGElement, {}, HTMLElement, any>;
    private settings: VisualSettings;
    private host:powerbi.extensibility.visual.IVisualHost;
    private selectionManager:powerbi.extensibility.ISelectionManager;
    private xAxis:d3.Selection<SVGElement, {}, HTMLElement, any>;
    private barchartSetting:BarChartSettings;
    // private staticData=[{
    //     value:10,
    //     category:"China"
    // },
    // {
    //     value:8,
    //     category:"USA"
    // },
    // {
    //     value:11,
    //     category:"India"
    // },
    // {
    //     value:5,
    //     category:"Germany"
    // }];
    
    constructor(options: VisualConstructorOptions) {
           this.svg = d3.select(options.element).append<SVGElement>('svg').classed("barChart",true);
           this.barContainer=this.svg.append('g').classed("barContainer",true);
           this.host=options.host;
           this.selectionManager=options.host.createSelectionManager();
           this.xAxis=this.svg.append('g').classed('xAxis',true);
    }

    private getOptionsValue<T>(objects:powerbi.DataViewObjects,objectName:string,propertyName:string,defaultValue:T):T{
        if(objects)
        {
            let object=objects[objectName];
            if(object)
            {
             let property:T=<T>object[propertyName];
             if(property!=undefined)
                {
                    return property;
                }
            }

        }
        return defaultValue;
    }
    private visualTransform(options: VisualUpdateOptions,host:powerbi.extensibility.visual.IVisualHost):BarChartViewModel {
        let dataViews=options.dataViews;
        let defaultSetting:BarChartSettings={
            enableAxis:{
                show:false
            }
        };
        let dataInfo:BarChartViewModel={dataPoints:[],
            dataMax:0,
            settings:defaultSetting
        };
        if(!dataViews || !dataViews[0]||!dataViews[0].categorical
            ||!dataViews[0].categorical.categories[0].source
            ||!dataViews[0].categorical.values)
            return dataInfo;
        let categorical=dataViews[0].categorical;
        let category=categorical.categories[0];
        let dataValues=categorical.values[0];
        let dataPoints:BarChartDataPoint[]=[];
        let dataMax:number;
        let objects=dataViews[0].metadata.objects;
        let colorPalette:powerbi.extensibility.IColorPalette=host.colorPalette;
        let barchartSettings:BarChartSettings={
            enableAxis:{
                show:this.getOptionsValue<boolean>(objects,'enableAxis','show',defaultSetting.enableAxis.show)
            }
        };

        for(let i=0,len=Math.max(category.values.length,dataValues.values.length);i<len;i++)
        {
            dataPoints.push({
                category:<string>category.values[i],
                value:<number>dataValues.values[i],
                color:colorPalette.getColor(<string>category.values[i]).value,
                selectionID:host.createSelectionIdBuilder().withCategory(category,i).createSelectionId()
            });
        }
        dataMax=<number>dataValues.maxLocal;
        return {
            dataPoints:dataPoints,
            dataMax:dataMax,
            settings:barchartSettings
        }
    }
    public update(options: VisualUpdateOptions) {
        let transformedData:BarChartViewModel=this.visualTransform(options,this.host);
        this.barchartSetting=transformedData.settings;
        let width=options.viewport.width;
        let height=options.viewport.height;
        this.svg.attr("width",width);
        this.svg.attr("height",height);
        if(this.barchartSetting.enableAxis.show)
        {
            height=height-25;
        }
        let minArray=[height,width];
        //let yScale=d3.scaleLinear().domain([0,11]).range([height,0])
        //let xScale=d3.scaleBand().domain(this.staticData.map(dp=>dp.category))
        this.xAxis.style('font-size',Math.min(height,width)*.04);
         let yScale=d3.scaleLinear().domain([0,transformedData.dataMax]).range([height,0])
        let xScale=d3.scaleBand().domain(transformedData.dataPoints.map(dp=>dp.category))
        .range([0,width]).round(true).paddingInner(.1).paddingOuter(.1);
        
        let xAxis=d3.axisBottom(xScale);
        var yAxis = d3.axisLeft(yScale);
        this.xAxis.attr('transform','translate(0,'+height+')').call(xAxis);
      
        //let bars=this.barContainer.selectAll(".bar").data(this.staticData);
        let bars=this.barContainer.selectAll(".bar").data(transformedData.dataPoints);
        bars.enter()
        .append('rect').classed("bar",true);

        bars.attr("width",xScale.bandwidth()).attr("height",data=>height-yScale(<number>data.value))
        .attr("x",data=>xScale(data.category))
        .attr("y",data=>yScale(<number>data.value))
        .attr("fill",data=>data.color);

        let selectionManager=this.selectionManager;
        bars.on("click",function(dataPoint){
            selectionManager.select(dataPoint.selectionID).then((ids:powerbi.extensibility.ISelectionId[])=>
                {
                    bars.attr('fill-opacity',ids.length>0?0.5:1)
                });
            d3.select(this).attr('fill-opacity',1);
        });
        bars.exit().remove();
        // .attr("height",50).attr("fill","red")
        // let rect=this.svg.append("rect").attr("width",50)
        // .attr("height",50).attr("fill","red")
        //this.settings = Visual.parseSettings(options && options.dataViews && options.dataViews[0]);
    }

    private static parseSettings(dataView: DataView): VisualSettings {
        return VisualSettings.parse(dataView) as VisualSettings;
    }

    /**
     * This function gets called for each of the objects defined in the capabilities files and allows you to select which of the
     * objects and properties you want to expose to the users in the property pane.
     *
     */
    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {
        //return VisualSettings.enumerateObjectInstances(this.settings || VisualSettings.getDefault(), options);
      let objectName=options.objectName;
      let objectEnumeration:powerbi.VisualObjectInstance[]=[];
      switch(objectName)
      {
          case 'enableAxis':
              objectEnumeration.push({
                  objectName:objectName,
                  properties:{
                      show:this.barchartSetting.enableAxis.show
                  },
                  selector:null
              })
      };
      return objectEnumeration;
    }
}



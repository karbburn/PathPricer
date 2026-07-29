"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { postPricePreview, getMarketQuote, ApiError } from "@/lib/api-client";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { serializeInputs } from "@/lib/url-state";
import { useDensity } from "@/lib/contexts/DensityContext";
import {
  MarketRegion,
  PricingPreviewResponse,
  PricingRequest,
  VarianceReductionMethod,
} from "@/lib/types";

interface TickerEntry {
  ticker: string;
  name: string;
  market: MarketRegion;
}

const TICKER_DATABASE: TickerEntry[] = [
  // US Stocks & ETFs
  { ticker: "A", name: "Agilent Technologies", market: "US" },
  { ticker: "AAPL", name: "APPLE INC.", market: "US" },
  { ticker: "ABBV", name: "AbbVie", market: "US" },
  { ticker: "ABNB", name: "AIRBNB, INC CL A CMN", market: "US" },
  { ticker: "ABT", name: "Abbott Laboratories", market: "US" },
  { ticker: "ACGL", name: "Arch Capital Group", market: "US" },
  { ticker: "ACN", name: "Accenture", market: "US" },
  { ticker: "ADBE", name: "ADOBE INC.", market: "US" },
  { ticker: "ADI", name: "ANALOG DEVICES CMN", market: "US" },
  { ticker: "ADM", name: "Archer Daniels Midland", market: "US" },
  { ticker: "ADP", name: "AUTOMATIC DATA PROCS", market: "US" },
  { ticker: "ADSK", name: "AUTODESK INC", market: "US" },
  { ticker: "AEE", name: "Ameren", market: "US" },
  { ticker: "AEP", name: "AMER ELC PWR CO CMN", market: "US" },
  { ticker: "AES", name: "AES Corporation", market: "US" },
  { ticker: "AFL", name: "Aflac", market: "US" },
  { ticker: "AGG", name: "iShares Core US Aggregate Bond ETF", market: "US" },
  { ticker: "AIG", name: "American International Group", market: "US" },
  { ticker: "AIZ", name: "Assurant", market: "US" },
  { ticker: "AJG", name: "Arthur J. Gallagher & Co.", market: "US" },
  { ticker: "AKAM", name: "Akamai Technologies", market: "US" },
  { ticker: "ALB", name: "Albemarle Corporation", market: "US" },
  { ticker: "ALGN", name: "Align Technology", market: "US" },
  { ticker: "ALL", name: "Allstate", market: "US" },
  { ticker: "ALLE", name: "Allegion", market: "US" },
  { ticker: "ALNY", name: "ALNYLAM PHARMACEUTICALS, INC.", market: "US" },
  { ticker: "AMAT", name: "APPLIED MATERIALS", market: "US" },
  { ticker: "AMCR", name: "Amcor", market: "US" },
  { ticker: "AMD", name: "ADV MICRO DEVICES", market: "US" },
  { ticker: "AME", name: "Ametek", market: "US" },
  { ticker: "AMGN", name: "AMGEN", market: "US" },
  { ticker: "AMP", name: "Ameriprise Financial", market: "US" },
  { ticker: "AMT", name: "American Tower", market: "US" },
  { ticker: "AMZN", name: "AMAZON.COM INC", market: "US" },
  { ticker: "ANET", name: "Arista Networks", market: "US" },
  { ticker: "AON", name: "Aon plc", market: "US" },
  { ticker: "AOS", name: "A. O. Smith", market: "US" },
  { ticker: "APA", name: "APA Corporation", market: "US" },
  { ticker: "APD", name: "Air Products", market: "US" },
  { ticker: "APH", name: "Amphenol", market: "US" },
  { ticker: "APO", name: "Apollo Global Management", market: "US" },
  { ticker: "APP", name: "APPLOVIN CORP CLA CM", market: "US" },
  { ticker: "APTV", name: "Aptiv", market: "US" },
  { ticker: "ARE", name: "Alexandria Real Estate Equities", market: "US" },
  { ticker: "ARES", name: "Ares Management", market: "US" },
  { ticker: "ARKK", name: "ARK Innovation ETF", market: "US" },
  { ticker: "ARM", name: "ARM HOLDINGS PLC ADS", market: "US" },
  { ticker: "ASML", name: "ASML HLDG NY REG", market: "US" },
  { ticker: "ATO", name: "Atmos Energy", market: "US" },
  { ticker: "AVB", name: "AvalonBay Communities", market: "US" },
  { ticker: "AVGO", name: "BROADCOM INC.", market: "US" },
  { ticker: "AVY", name: "Avery Dennison", market: "US" },
  { ticker: "AWK", name: "American Water Works", market: "US" },
  { ticker: "AXON", name: "AXON ENTERPRISE, INC", market: "US" },
  { ticker: "AXP", name: "American Express", market: "US" },
  { ticker: "AZO", name: "AutoZone", market: "US" },
  { ticker: "BA", name: "Boeing", market: "US" },
  { ticker: "BAC", name: "Bank of America", market: "US" },
  { ticker: "BALL", name: "Ball Corporation", market: "US" },
  { ticker: "BAX", name: "Baxter International", market: "US" },
  { ticker: "BBY", name: "Best Buy", market: "US" },
  { ticker: "BDX", name: "Becton Dickinson", market: "US" },
  { ticker: "BEN", name: "Franklin Resources", market: "US" },
  { ticker: "BF.B", name: "Brown–Forman", market: "US" },
  { ticker: "BG", name: "Bunge Global", market: "US" },
  { ticker: "BIIB", name: "Biogen", market: "US" },
  { ticker: "BKNG", name: "BOOKING HOLDINGS INC", market: "US" },
  { ticker: "BKR", name: "BAKER HUGHES CO", market: "US" },
  { ticker: "BLDR", name: "Builders FirstSource", market: "US" },
  { ticker: "BLK", name: "BlackRock", market: "US" },
  { ticker: "BMY", name: "Bristol Myers Squibb", market: "US" },
  { ticker: "BND", name: "Vanguard Total Bond Market ETF", market: "US" },
  { ticker: "BNY", name: "BNY Mellon", market: "US" },
  { ticker: "BR", name: "Broadridge Financial Solutions", market: "US" },
  { ticker: "BRK.B", name: "Berkshire Hathaway", market: "US" },
  { ticker: "BRO", name: "Brown & Brown", market: "US" },
  { ticker: "BSX", name: "Boston Scientific", market: "US" },
  { ticker: "BX", name: "Blackstone Inc.", market: "US" },
  { ticker: "BXP", name: "BXP, Inc.", market: "US" },
  { ticker: "C", name: "Citigroup", market: "US" },
  { ticker: "CAH", name: "Cardinal Health", market: "US" },
  { ticker: "CARR", name: "Carrier Global", market: "US" },
  { ticker: "CASY", name: "Casey's", market: "US" },
  { ticker: "CAT", name: "Caterpillar Inc.", market: "US" },
  { ticker: "CB", name: "Chubb Limited", market: "US" },
  { ticker: "CBOE", name: "Cboe Global Markets", market: "US" },
  { ticker: "CBRE", name: "CBRE Group", market: "US" },
  { ticker: "CCEP", name: "COCA-COLA EUROPACIFI", market: "US" },
  { ticker: "CCI", name: "Crown Castle", market: "US" },
  { ticker: "CCL", name: "Carnival Corporation", market: "US" },
  { ticker: "CDNS", name: "CADENCE DESIGN SYS", market: "US" },
  { ticker: "CDW", name: "CDW Corporation", market: "US" },
  { ticker: "CEG", name: "CONSTELLATION EN CM", market: "US" },
  { ticker: "CF", name: "CF Industries", market: "US" },
  { ticker: "CFG", name: "Citizens Financial Group", market: "US" },
  { ticker: "CHD", name: "Church & Dwight", market: "US" },
  { ticker: "CHRW", name: "C.H. Robinson", market: "US" },
  { ticker: "CHTR", name: "CHARTER COMMUNICATIO", market: "US" },
  { ticker: "CI", name: "Cigna", market: "US" },
  { ticker: "CIEN", name: "Ciena", market: "US" },
  { ticker: "CINF", name: "Cincinnati Financial", market: "US" },
  { ticker: "CL", name: "Colgate-Palmolive", market: "US" },
  { ticker: "CLX", name: "Clorox", market: "US" },
  { ticker: "CMCSA", name: "COMCAST CORP A", market: "US" },
  { ticker: "CME", name: "CME Group", market: "US" },
  { ticker: "CMG", name: "Chipotle Mexican Grill", market: "US" },
  { ticker: "CMI", name: "Cummins", market: "US" },
  { ticker: "CMS", name: "CMS Energy", market: "US" },
  { ticker: "CNC", name: "Centene Corporation", market: "US" },
  { ticker: "CNP", name: "CenterPoint Energy", market: "US" },
  { ticker: "COF", name: "Capital One", market: "US" },
  { ticker: "COHR", name: "Coherent Corp.", market: "US" },
  { ticker: "COIN", name: "Coinbase", market: "US" },
  { ticker: "COO", name: "Cooper Companies (The)", market: "US" },
  { ticker: "COP", name: "ConocoPhillips", market: "US" },
  { ticker: "COR", name: "Cencora", market: "US" },
  { ticker: "COST", name: "COSTCO WHOLESALE", market: "US" },
  { ticker: "CPAY", name: "Corpay", market: "US" },
  { ticker: "CPRT", name: "COPART, INC.", market: "US" },
  { ticker: "CPT", name: "Camden Property Trust", market: "US" },
  { ticker: "CRH", name: "CRH plc", market: "US" },
  { ticker: "CRL", name: "Charles River Laboratories", market: "US" },
  { ticker: "CRM", name: "Salesforce", market: "US" },
  { ticker: "CRWD", name: "CROWDSTRIKE HLD CM A", market: "US" },
  { ticker: "CSCO", name: "CISCO SYSTEMS INC.", market: "US" },
  { ticker: "CSGP", name: "COSTAR GROUP INC", market: "US" },
  { ticker: "CSX", name: "CSX CORPORATION", market: "US" },
  { ticker: "CTAS", name: "CINTAS CORP", market: "US" },
  { ticker: "CTSH", name: "COGNIZANT TECH SOL", market: "US" },
  { ticker: "CTVA", name: "Corteva", market: "US" },
  { ticker: "CVNA", name: "Carvana", market: "US" },
  { ticker: "CVS", name: "CVS Health", market: "US" },
  { ticker: "CVX", name: "Chevron Corporation", market: "US" },
  { ticker: "D", name: "Dominion Energy", market: "US" },
  { ticker: "DAL", name: "Delta Air Lines", market: "US" },
  { ticker: "DASH", name: "DOORDASH, INC. CL A", market: "US" },
  { ticker: "DD", name: "DuPont", market: "US" },
  { ticker: "DDOG", name: "DATADOG INC.L A CM", market: "US" },
  { ticker: "DE", name: "Deere & Company", market: "US" },
  { ticker: "DECK", name: "Deckers Brands", market: "US" },
  { ticker: "DELL", name: "Dell Technologies", market: "US" },
  { ticker: "DG", name: "Dollar General", market: "US" },
  { ticker: "DGX", name: "Quest Diagnostics", market: "US" },
  { ticker: "DHI", name: "D. R. Horton", market: "US" },
  { ticker: "DHR", name: "Danaher Corporation", market: "US" },
  { ticker: "DIA", name: "SPDR Dow Jones ETF", market: "US" },
  { ticker: "DIS", name: "Walt Disney Company (The)", market: "US" },
  { ticker: "DLR", name: "Digital Realty", market: "US" },
  { ticker: "DLTR", name: "Dollar Tree", market: "US" },
  { ticker: "DOC", name: "Healthpeak Properties", market: "US" },
  { ticker: "DOV", name: "Dover Corporation", market: "US" },
  { ticker: "DOW", name: "Dow Inc.", market: "US" },
  { ticker: "DPZ", name: "Domino's", market: "US" },
  { ticker: "DRI", name: "Darden Restaurants", market: "US" },
  { ticker: "DTE", name: "DTE Energy", market: "US" },
  { ticker: "DUK", name: "Duke Energy", market: "US" },
  { ticker: "DVA", name: "DaVita", market: "US" },
  { ticker: "DVN", name: "Devon Energy", market: "US" },
  { ticker: "DXCM", name: "DEXCOM", market: "US" },
  { ticker: "EA", name: "ELECTRONIC ARTS INC", market: "US" },
  { ticker: "EBAY", name: "eBay Inc.", market: "US" },
  { ticker: "ECHO", name: "EchoStar", market: "US" },
  { ticker: "ECL", name: "Ecolab", market: "US" },
  { ticker: "ED", name: "Consolidated Edison", market: "US" },
  { ticker: "EEM", name: "iShares MSCI Emerging Markets ETF", market: "US" },
  { ticker: "EFX", name: "Equifax", market: "US" },
  { ticker: "EG", name: "Everest Group", market: "US" },
  { ticker: "EIX", name: "Edison International", market: "US" },
  { ticker: "EL", name: "Estée Lauder Companies (The)", market: "US" },
  { ticker: "ELV", name: "Elevance Health", market: "US" },
  { ticker: "EME", name: "Emcor", market: "US" },
  { ticker: "EMR", name: "Emerson Electric", market: "US" },
  { ticker: "EOG", name: "EOG Resources", market: "US" },
  { ticker: "EPI", name: "WisdomTree India Earnings Fund", market: "US" },
  { ticker: "EQIX", name: "Equinix", market: "US" },
  { ticker: "EQR", name: "Equity Residential", market: "US" },
  { ticker: "EQT", name: "EQT Corporation", market: "US" },
  { ticker: "ERIE", name: "Erie Indemnity", market: "US" },
  { ticker: "ES", name: "Eversource Energy", market: "US" },
  { ticker: "ESS", name: "Essex Property Trust", market: "US" },
  { ticker: "ETN", name: "Eaton Corporation", market: "US" },
  { ticker: "ETR", name: "Entergy", market: "US" },
  { ticker: "EVRG", name: "Evergy", market: "US" },
  { ticker: "EW", name: "Edwards Lifesciences", market: "US" },
  { ticker: "EWJ", name: "iShares MSCI Japan ETF", market: "US" },
  { ticker: "EWZ", name: "iShares MSCI Brazil ETF", market: "US" },
  { ticker: "EXC", name: "EXELON CORP CMN STK", market: "US" },
  { ticker: "EXE", name: "Expand Energy", market: "US" },
  { ticker: "EXPD", name: "Expeditors International", market: "US" },
  { ticker: "EXPE", name: "Expedia Group", market: "US" },
  { ticker: "EXR", name: "Extra Space Storage", market: "US" },
  { ticker: "F", name: "Ford Motor Company", market: "US" },
  { ticker: "FANG", name: "DIAMONDBACK ENERGY", market: "US" },
  { ticker: "FAST", name: "FASTENAL CO", market: "US" },
  { ticker: "FCX", name: "Freeport-McMoRan", market: "US" },
  { ticker: "FDS", name: "FactSet", market: "US" },
  { ticker: "FDX", name: "FedEx", market: "US" },
  { ticker: "FDXF", name: "FedEx Freight", market: "US" },
  { ticker: "FE", name: "FirstEnergy", market: "US" },
  { ticker: "FER", name: "FERROVIAL SE", market: "US" },
  { ticker: "FFIV", name: "F5, Inc.", market: "US" },
  { ticker: "FICO", name: "Fair Isaac", market: "US" },
  { ticker: "FIS", name: "Fidelity National Information Services", market: "US" },
  { ticker: "FISV", name: "Fiserv", market: "US" },
  { ticker: "FITB", name: "Fifth Third Bancorp", market: "US" },
  { ticker: "FIX", name: "Comfort Systems USA", market: "US" },
  { ticker: "FLEX", name: "Flex Ltd.", market: "US" },
  { ticker: "FOX", name: "Fox Corporation(Class B)", market: "US" },
  { ticker: "FOXA", name: "Fox Corporation(Class A)", market: "US" },
  { ticker: "FRT", name: "Federal Realty Investment Trust", market: "US" },
  { ticker: "FSLR", name: "First Solar", market: "US" },
  { ticker: "FTNT", name: "FORTINET, INC.", market: "US" },
  { ticker: "FTV", name: "Fortive", market: "US" },
  { ticker: "FXI", name: "iShares China Large-Cap ETF", market: "US" },
  { ticker: "GD", name: "General Dynamics", market: "US" },
  { ticker: "GDDY", name: "GoDaddy", market: "US" },
  { ticker: "GE", name: "GE Aerospace", market: "US" },
  { ticker: "GEHC", name: "GE HEALTHCARE CM", market: "US" },
  { ticker: "GEN", name: "Gen Digital", market: "US" },
  { ticker: "GEV", name: "GE Vernova", market: "US" },
  { ticker: "GILD", name: "GILEAD SCIENCES, INC", market: "US" },
  { ticker: "GIS", name: "General Mills", market: "US" },
  { ticker: "GL", name: "Globe Life", market: "US" },
  { ticker: "GLD", name: "SPDR Gold Shares", market: "US" },
  { ticker: "GLW", name: "Corning Inc.", market: "US" },
  { ticker: "GM", name: "General Motors", market: "US" },
  { ticker: "GNRC", name: "Generac", market: "US" },
  { ticker: "GOOG", name: "ALPHABET CL C CAP", market: "US" },
  { ticker: "GOOGL", name: "ALPHABET CL A CMN", market: "US" },
  { ticker: "GPC", name: "Genuine Parts Company", market: "US" },
  { ticker: "GPN", name: "Global Payments", market: "US" },
  { ticker: "GRMN", name: "Garmin", market: "US" },
  { ticker: "GS", name: "Goldman Sachs", market: "US" },
  { ticker: "GWW", name: "W. W. Grainger", market: "US" },
  { ticker: "HAL", name: "Halliburton", market: "US" },
  { ticker: "HAS", name: "Hasbro", market: "US" },
  { ticker: "HBAN", name: "Huntington Bancshares", market: "US" },
  { ticker: "HCA", name: "HCA Healthcare", market: "US" },
  { ticker: "HD", name: "Home Depot (The)", market: "US" },
  { ticker: "HIG", name: "Hartford (The)", market: "US" },
  { ticker: "HII", name: "Huntington Ingalls Industries", market: "US" },
  { ticker: "HLT", name: "Hilton Worldwide", market: "US" },
  { ticker: "HON", name: "HONEYWELL INTL INC", market: "US" },
  { ticker: "HONA", name: "Honeywell Aerospace", market: "US" },
  { ticker: "HOOD", name: "Robinhood Markets", market: "US" },
  { ticker: "HPE", name: "Hewlett Packard Enterprise", market: "US" },
  { ticker: "HPQ", name: "HP Inc.", market: "US" },
  { ticker: "HRL", name: "Hormel Foods", market: "US" },
  { ticker: "HSIC", name: "Henry Schein", market: "US" },
  { ticker: "HST", name: "Host Hotels & Resorts", market: "US" },
  { ticker: "HSY", name: "Hershey Company (The)", market: "US" },
  { ticker: "HUBB", name: "Hubbell Incorporated", market: "US" },
  { ticker: "HUM", name: "Humana", market: "US" },
  { ticker: "HWM", name: "Howmet Aerospace", market: "US" },
  { ticker: "HYG", name: "iShares iBoxx High Yield Corporate Bond ETF", market: "US" },
  { ticker: "IBB", name: "iShares Biotechnology ETF", market: "US" },
  { ticker: "IBKR", name: "Interactive Brokers", market: "US" },
  { ticker: "IBM", name: "IBM", market: "US" },
  { ticker: "ICE", name: "Intercontinental Exchange", market: "US" },
  { ticker: "ICLN", name: "iShares Global Clean Energy ETF", market: "US" },
  { ticker: "IDXX", name: "IDEXX LABORATORIES", market: "US" },
  { ticker: "IEF", name: "iShares 7-10 Year Treasury Bond ETF", market: "US" },
  { ticker: "IEFA", name: "iShares Core MSCI EAFE ETF", market: "US" },
  { ticker: "IEX", name: "IDEX Corporation", market: "US" },
  { ticker: "IFF", name: "International Flavors & Fragrances", market: "US" },
  { ticker: "IJH", name: "iShares Core S&P Mid-Cap ETF", market: "US" },
  { ticker: "IJR", name: "iShares Core S&P Small-Cap ETF", market: "US" },
  { ticker: "INCY", name: "Incyte", market: "US" },
  { ticker: "INDA", name: "iShares MSCI India ETF", market: "US" },
  { ticker: "INSM", name: "INSMED INCORPORATED", market: "US" },
  { ticker: "INTC", name: "INTEL CORP", market: "US" },
  { ticker: "INTU", name: "INTUIT INC", market: "US" },
  { ticker: "INVH", name: "Invitation Homes", market: "US" },
  { ticker: "IP", name: "International Paper", market: "US" },
  { ticker: "IQV", name: "IQVIA", market: "US" },
  { ticker: "IR", name: "Ingersoll Rand", market: "US" },
  { ticker: "IRM", name: "Iron Mountain", market: "US" },
  { ticker: "ISRG", name: "INTUITIVE SURG, INC.", market: "US" },
  { ticker: "IT", name: "Gartner", market: "US" },
  { ticker: "ITW", name: "Illinois Tool Works", market: "US" },
  { ticker: "IVV", name: "iShares Core S&P 500 ETF", market: "US" },
  { ticker: "IVZ", name: "Invesco", market: "US" },
  { ticker: "IWM", name: "iShares Russell 2000 ETF", market: "US" },
  { ticker: "J", name: "Jacobs Solutions", market: "US" },
  { ticker: "JBHT", name: "J.B. Hunt", market: "US" },
  { ticker: "JBL", name: "Jabil", market: "US" },
  { ticker: "JCI", name: "Johnson Controls", market: "US" },
  { ticker: "JKHY", name: "Jack Henry & Associates", market: "US" },
  { ticker: "JNJ", name: "Johnson & Johnson", market: "US" },
  { ticker: "JPM", name: "JPMorgan Chase", market: "US" },
  { ticker: "KDP", name: "KEURIG DR PEPPER INC", market: "US" },
  { ticker: "KEY", name: "KeyCorp", market: "US" },
  { ticker: "KEYS", name: "Keysight Technologies", market: "US" },
  { ticker: "KHC", name: "KRAFT HEINZ CO CMN", market: "US" },
  { ticker: "KIM", name: "Kimco Realty", market: "US" },
  { ticker: "KKR", name: "KKR & Co.", market: "US" },
  { ticker: "KLAC", name: "KLA CP CMN STK", market: "US" },
  { ticker: "KMB", name: "Kimberly-Clark", market: "US" },
  { ticker: "KMI", name: "Kinder Morgan", market: "US" },
  { ticker: "KO", name: "Coca-Cola Company (The)", market: "US" },
  { ticker: "KR", name: "Kroger", market: "US" },
  { ticker: "KRE", name: "SPDR S&P Regional Banking ETF", market: "US" },
  { ticker: "KVUE", name: "Kenvue", market: "US" },
  { ticker: "L", name: "Loews Corporation", market: "US" },
  { ticker: "LDOS", name: "Leidos", market: "US" },
  { ticker: "LEN", name: "Lennar", market: "US" },
  { ticker: "LH", name: "Labcorp", market: "US" },
  { ticker: "LHX", name: "L3Harris", market: "US" },
  { ticker: "LII", name: "Lennox International", market: "US" },
  { ticker: "LIN", name: "LINDE PLC", market: "US" },
  { ticker: "LITE", name: "Lumentum", market: "US" },
  { ticker: "LLY", name: "Lilly (Eli)", market: "US" },
  { ticker: "LMT", name: "Lockheed Martin", market: "US" },
  { ticker: "LNT", name: "Alliant Energy", market: "US" },
  { ticker: "LOW", name: "Lowe's", market: "US" },
  { ticker: "LQD", name: "iShares iBoxx Investment Grade Corporate Bond ETF", market: "US" },
  { ticker: "LRCX", name: "LAM RESEARCH CORP", market: "US" },
  { ticker: "LULU", name: "Lululemon Athletica", market: "US" },
  { ticker: "LUV", name: "Southwest Airlines", market: "US" },
  { ticker: "LVS", name: "Las Vegas Sands", market: "US" },
  { ticker: "LYB", name: "LyondellBasell", market: "US" },
  { ticker: "LYV", name: "Live Nation Entertainment", market: "US" },
  { ticker: "MA", name: "Mastercard", market: "US" },
  { ticker: "MAA", name: "Mid-America Apartment Communities", market: "US" },
  { ticker: "MAR", name: "MARRIOTT INT CL A CM", market: "US" },
  { ticker: "MAS", name: "Masco", market: "US" },
  { ticker: "MCD", name: "McDonald's", market: "US" },
  { ticker: "MCHP", name: "MICROCHIP TECHNOLOGY", market: "US" },
  { ticker: "MCK", name: "McKesson Corporation", market: "US" },
  { ticker: "MCO", name: "Moody's Corporation", market: "US" },
  { ticker: "MDLZ", name: "MONDELEZ INTL CMN A", market: "US" },
  { ticker: "MDT", name: "Medtronic", market: "US" },
  { ticker: "MELI", name: "MERCADOLIBRE, INC.", market: "US" },
  { ticker: "MET", name: "MetLife", market: "US" },
  { ticker: "META", name: "META PLATFORMS, INC.", market: "US" },
  { ticker: "MGM", name: "MGM Resorts", market: "US" },
  { ticker: "MKC", name: "McCormick & Company", market: "US" },
  { ticker: "MLM", name: "Martin Marietta Materials", market: "US" },
  { ticker: "MMM", name: "3M", market: "US" },
  { ticker: "MNST", name: "MONSTER BEVERAGE CP", market: "US" },
  { ticker: "MO", name: "Altria", market: "US" },
  { ticker: "MOAT", name: "VanEck Morningstar Wide Moat ETF", market: "US" },
  { ticker: "MOS", name: "Mosaic Company (The)", market: "US" },
  { ticker: "MPC", name: "Marathon Petroleum", market: "US" },
  { ticker: "MPWR", name: "MONOLITHIC POWER SYSTEMS, INC.", market: "US" },
  { ticker: "MRK", name: "Merck & Co.", market: "US" },
  { ticker: "MRNA", name: "Moderna", market: "US" },
  { ticker: "MRSH", name: "Marsh McLennan", market: "US" },
  { ticker: "MRVL", name: "MARVELL TECH INC CMN", market: "US" },
  { ticker: "MS", name: "Morgan Stanley", market: "US" },
  { ticker: "MSCI", name: "MSCI Inc.", market: "US" },
  { ticker: "MSFT", name: "MICROSOFT CORP", market: "US" },
  { ticker: "MSI", name: "Motorola Solutions", market: "US" },
  { ticker: "MSTR", name: "MICROSTRATEGY INCORPORATED", market: "US" },
  { ticker: "MTB", name: "M&T Bank", market: "US" },
  { ticker: "MTD", name: "Mettler Toledo", market: "US" },
  { ticker: "MU", name: "MICRON TECHNOLOGY", market: "US" },
  { ticker: "MUB", name: "iShares National Muni Bond ETF", market: "US" },
  { ticker: "NCLH", name: "Norwegian Cruise Line Holdings", market: "US" },
  { ticker: "NDAQ", name: "Nasdaq, Inc.", market: "US" },
  { ticker: "NDSN", name: "Nordson Corporation", market: "US" },
  { ticker: "NEE", name: "NextEra Energy", market: "US" },
  { ticker: "NEM", name: "Newmont", market: "US" },
  { ticker: "NFLX", name: "NETFLIX, INC.", market: "US" },
  { ticker: "NI", name: "NiSource", market: "US" },
  { ticker: "NKE", name: "Nike, Inc.", market: "US" },
  { ticker: "NOC", name: "Northrop Grumman", market: "US" },
  { ticker: "NOW", name: "ServiceNow", market: "US" },
  { ticker: "NRG", name: "NRG Energy", market: "US" },
  { ticker: "NSC", name: "Norfolk Southern", market: "US" },
  { ticker: "NTAP", name: "NetApp", market: "US" },
  { ticker: "NTRS", name: "Northern Trust", market: "US" },
  { ticker: "NUE", name: "Nucor", market: "US" },
  { ticker: "NVDA", name: "NVIDIA CORPORATION", market: "US" },
  { ticker: "NVR", name: "NVR, Inc.", market: "US" },
  { ticker: "NWS", name: "News Corp(Class B)", market: "US" },
  { ticker: "NWSA", name: "News Corp(Class A)", market: "US" },
  { ticker: "NXPI", name: "NXP SEMICONDUCTORS", market: "US" },
  { ticker: "O", name: "Realty Income", market: "US" },
  { ticker: "ODFL", name: "OLD DOMINION FREIG", market: "US" },
  { ticker: "OKE", name: "Oneok", market: "US" },
  { ticker: "OMC", name: "Omnicom Group", market: "US" },
  { ticker: "ON", name: "ON Semiconductor", market: "US" },
  { ticker: "ORCL", name: "Oracle Corporation", market: "US" },
  { ticker: "ORLY", name: "O'REILLY AUTOMOTIVE", market: "US" },
  { ticker: "OTIS", name: "Otis Worldwide", market: "US" },
  { ticker: "OXY", name: "Occidental Petroleum", market: "US" },
  { ticker: "PANW", name: "PALO ALTO NTWKS CM", market: "US" },
  { ticker: "PAYX", name: "PAYCHEX, INC.", market: "US" },
  { ticker: "PCAR", name: "PACCAR INC.", market: "US" },
  { ticker: "PCG", name: "PG&E Corporation", market: "US" },
  { ticker: "PDD", name: "PDD HOLDINGS INC ADS", market: "US" },
  { ticker: "PEG", name: "Public Service Enterprise Group", market: "US" },
  { ticker: "PEP", name: "PEPSICO INC", market: "US" },
  { ticker: "PFE", name: "Pfizer", market: "US" },
  { ticker: "PFG", name: "Principal Financial Group", market: "US" },
  { ticker: "PG", name: "Procter & Gamble", market: "US" },
  { ticker: "PGR", name: "Progressive Corporation", market: "US" },
  { ticker: "PH", name: "Parker Hannifin", market: "US" },
  { ticker: "PHM", name: "PulteGroup", market: "US" },
  { ticker: "PKG", name: "Packaging Corporation of America", market: "US" },
  { ticker: "PLD", name: "Prologis", market: "US" },
  { ticker: "PLTR", name: "PALANTIR TECHNOLOGIES INC.", market: "US" },
  { ticker: "PM", name: "Philip Morris International", market: "US" },
  { ticker: "PNC", name: "PNC Financial Services", market: "US" },
  { ticker: "PNR", name: "Pentair", market: "US" },
  { ticker: "PNW", name: "Pinnacle West Capital", market: "US" },
  { ticker: "PODD", name: "Insulet Corporation", market: "US" },
  { ticker: "PPG", name: "PPG Industries", market: "US" },
  { ticker: "PPL", name: "PPL Corporation", market: "US" },
  { ticker: "PRU", name: "Prudential Financial", market: "US" },
  { ticker: "PSA", name: "Public Storage", market: "US" },
  { ticker: "PSKY", name: "Paramount Skydance Corporation", market: "US" },
  { ticker: "PSX", name: "Phillips 66", market: "US" },
  { ticker: "PTC", name: "PTC Inc.", market: "US" },
  { ticker: "PWR", name: "Quanta Services", market: "US" },
  { ticker: "PYPL", name: "PAYPAL HOLDINGS", market: "US" },
  { ticker: "Q", name: "Qnity Electronics", market: "US" },
  { ticker: "QCOM", name: "QUALCOMM INC", market: "US" },
  { ticker: "QQQ", name: "Invesco QQQ Trust", market: "US" },
  { ticker: "RCL", name: "Royal Caribbean Group", market: "US" },
  { ticker: "REG", name: "Regency Centers", market: "US" },
  { ticker: "REGN", name: "REGENERON PHARMACEUT", market: "US" },
  { ticker: "RF", name: "Regions Financial Corporation", market: "US" },
  { ticker: "RJF", name: "Raymond James Financial", market: "US" },
  { ticker: "RL", name: "Ralph Lauren Corporation", market: "US" },
  { ticker: "RMD", name: "ResMed", market: "US" },
  { ticker: "ROK", name: "Rockwell Automation", market: "US" },
  { ticker: "ROL", name: "Rollins, Inc.", market: "US" },
  { ticker: "ROP", name: "ROPER TECH CMN", market: "US" },
  { ticker: "ROST", name: "ROSS STORES, INC.", market: "US" },
  { ticker: "RSG", name: "Republic Services", market: "US" },
  { ticker: "RTX", name: "RTX Corporation", market: "US" },
  { ticker: "RVTY", name: "Revvity", market: "US" },
  { ticker: "SBAC", name: "SBA Communications", market: "US" },
  { ticker: "SBUX", name: "STARBUCKS CORP", market: "US" },
  { ticker: "SCHD", name: "Schwab US Dividend Equity ETF", market: "US" },
  { ticker: "SCHW", name: "Charles Schwab Corporation", market: "US" },
  { ticker: "SHOP", name: "SHOPIFY, INC.", market: "US" },
  { ticker: "SHW", name: "Sherwin-Williams", market: "US" },
  { ticker: "SHY", name: "iShares 1-3 Year Treasury Bond ETF", market: "US" },
  { ticker: "SJM", name: "J.M. Smucker Company (The)", market: "US" },
  { ticker: "SLB", name: "Schlumberger", market: "US" },
  { ticker: "SLV", name: "iShares Silver Trust", market: "US" },
  { ticker: "SMCI", name: "Supermicro", market: "US" },
  { ticker: "SMH", name: "VanEck Semiconductor ETF", market: "US" },
  { ticker: "SNA", name: "Snap-on", market: "US" },
  { ticker: "SNDK", name: "Sandisk", market: "US" },
  { ticker: "SNPS", name: "SYNOPSYS, INC.", market: "US" },
  { ticker: "SO", name: "Southern Company", market: "US" },
  { ticker: "SOLV", name: "Solventum", market: "US" },
  { ticker: "SOXX", name: "iShares Semiconductor ETF", market: "US" },
  { ticker: "SPG", name: "Simon Property Group", market: "US" },
  { ticker: "SPGI", name: "S&P Global", market: "US" },
  { ticker: "SPY", name: "SPDR S&P 500 ETF", market: "US" },
  { ticker: "SRE", name: "Sempra", market: "US" },
  { ticker: "STE", name: "Steris", market: "US" },
  { ticker: "STLD", name: "Steel Dynamics", market: "US" },
  { ticker: "STT", name: "State Street Corporation", market: "US" },
  { ticker: "STX", name: "SEAGATE TECHNOLOGY HOLDINGS PLC", market: "US" },
  { ticker: "STZ", name: "Constellation Brands", market: "US" },
  { ticker: "SW", name: "Smurfit Westrock", market: "US" },
  { ticker: "SWK", name: "Stanley Black & Decker", market: "US" },
  { ticker: "SWKS", name: "Skyworks Solutions", market: "US" },
  { ticker: "SYF", name: "Synchrony Financial", market: "US" },
  { ticker: "SYK", name: "Stryker Corporation", market: "US" },
  { ticker: "SYY", name: "Sysco", market: "US" },
  { ticker: "T", name: "AT&T", market: "US" },
  { ticker: "TAP", name: "Molson Coors Beverage Company", market: "US" },
  { ticker: "TDG", name: "TransDigm Group", market: "US" },
  { ticker: "TDY", name: "Teledyne Technologies", market: "US" },
  { ticker: "TEAM", name: "ATLASSIAN CLS A CS", market: "US" },
  { ticker: "TECH", name: "Bio-Techne", market: "US" },
  { ticker: "TEL", name: "TE Connectivity", market: "US" },
  { ticker: "TER", name: "Teradyne", market: "US" },
  { ticker: "TFC", name: "Truist Financial", market: "US" },
  { ticker: "TGT", name: "Target Corporation", market: "US" },
  { ticker: "TIP", name: "iShares TIPS Bond ETF", market: "US" },
  { ticker: "TJX", name: "TJX Companies", market: "US" },
  { ticker: "TKO", name: "TKO Group Holdings", market: "US" },
  { ticker: "TLT", name: "iShares 20+ Year Treasury Bond ETF", market: "US" },
  { ticker: "TMO", name: "Thermo Fisher Scientific", market: "US" },
  { ticker: "TMUS", name: "T-MOBILE US CMN", market: "US" },
  { ticker: "TPL", name: "Texas Pacific Land Corporation", market: "US" },
  { ticker: "TPR", name: "Tapestry, Inc.", market: "US" },
  { ticker: "TRGP", name: "Targa Resources", market: "US" },
  { ticker: "TRI", name: "THOMSON REUTERS CORP", market: "US" },
  { ticker: "TRMB", name: "Trimble Inc.", market: "US" },
  { ticker: "TROW", name: "T. Rowe Price", market: "US" },
  { ticker: "TRV", name: "Travelers Companies (The)", market: "US" },
  { ticker: "TSCO", name: "Tractor Supply", market: "US" },
  { ticker: "TSLA", name: "TESLA, INC.", market: "US" },
  { ticker: "TSN", name: "Tyson Foods", market: "US" },
  { ticker: "TT", name: "Trane Technologies", market: "US" },
  { ticker: "TTD", name: "Trade Desk (The)", market: "US" },
  { ticker: "TTWO", name: "TAKE-TWO INTERACTI", market: "US" },
  { ticker: "TXN", name: "TEXAS INSTRUMENTS", market: "US" },
  { ticker: "TXT", name: "Textron", market: "US" },
  { ticker: "TYL", name: "Tyler Technologies", market: "US" },
  { ticker: "UAL", name: "United Airlines Holdings", market: "US" },
  { ticker: "UBER", name: "Uber", market: "US" },
  { ticker: "UDR", name: "UDR, Inc.", market: "US" },
  { ticker: "UHS", name: "Universal Health Services", market: "US" },
  { ticker: "ULTA", name: "Ulta Beauty", market: "US" },
  { ticker: "UNH", name: "UnitedHealth Group", market: "US" },
  { ticker: "UNP", name: "Union Pacific Corporation", market: "US" },
  { ticker: "UPS", name: "United Parcel Service", market: "US" },
  { ticker: "URI", name: "United Rentals", market: "US" },
  { ticker: "USB", name: "U.S. Bancorp", market: "US" },
  { ticker: "V", name: "Visa Inc.", market: "US" },
  { ticker: "VEEV", name: "Veeva Systems", market: "US" },
  { ticker: "VICI", name: "Vici Properties", market: "US" },
  { ticker: "VIG", name: "Vanguard Dividend Appreciation ETF", market: "US" },
  { ticker: "VLO", name: "Valero Energy", market: "US" },
  { ticker: "VLTO", name: "Veralto", market: "US" },
  { ticker: "VMC", name: "Vulcan Materials Company", market: "US" },
  { ticker: "VNQ", name: "Vanguard Real Estate ETF", market: "US" },
  { ticker: "VOO", name: "Vanguard S&P 500 ETF", market: "US" },
  { ticker: "VRSK", name: "VERISK ANALYTICS INC", market: "US" },
  { ticker: "VRSN", name: "Verisign", market: "US" },
  { ticker: "VRT", name: "Vertiv", market: "US" },
  { ticker: "VRTX", name: "VERTEX PHARMACEUTIC", market: "US" },
  { ticker: "VST", name: "Vistra Corp.", market: "US" },
  { ticker: "VT", name: "Vanguard Total World Stock ETF", market: "US" },
  { ticker: "VTI", name: "Vanguard Total Stock Market ETF", market: "US" },
  { ticker: "VTR", name: "Ventas", market: "US" },
  { ticker: "VTRS", name: "Viatris", market: "US" },
  { ticker: "VWO", name: "Vanguard FTSE Emerging Markets ETF", market: "US" },
  { ticker: "VXUS", name: "Vanguard Total International Stock ETF", market: "US" },
  { ticker: "VZ", name: "Verizon", market: "US" },
  { ticker: "WAB", name: "Wabtec", market: "US" },
  { ticker: "WAT", name: "Waters Corporation", market: "US" },
  { ticker: "WBD", name: "WRNR BRS DS CM WI", market: "US" },
  { ticker: "WDAY", name: "WORKDAY INC CL A", market: "US" },
  { ticker: "WDC", name: "WESTERN DIGITAL CORP.", market: "US" },
  { ticker: "WEC", name: "WEC Energy Group", market: "US" },
  { ticker: "WELL", name: "Welltower", market: "US" },
  { ticker: "WFC", name: "Wells Fargo", market: "US" },
  { ticker: "WM", name: "Waste Management", market: "US" },
  { ticker: "WMB", name: "Williams Companies", market: "US" },
  { ticker: "WMT", name: "WALMART. INC", market: "US" },
  { ticker: "WRB", name: "W. R. Berkley Corporation", market: "US" },
  { ticker: "WSM", name: "Williams-Sonoma, Inc.", market: "US" },
  { ticker: "WST", name: "West Pharmaceutical Services", market: "US" },
  { ticker: "WTW", name: "Willis Towers Watson", market: "US" },
  { ticker: "WY", name: "Weyerhaeuser", market: "US" },
  { ticker: "WYNN", name: "Wynn Resorts", market: "US" },
  { ticker: "XBI", name: "SPDR S&P Biotech ETF", market: "US" },
  { ticker: "XEL", name: "XCEL ENERGY CMN", market: "US" },
  { ticker: "XLE", name: "Energy Select Sector SPDR", market: "US" },
  { ticker: "XLF", name: "Financial Select Sector SPDR", market: "US" },
  { ticker: "XLI", name: "Industrial Select Sector SPDR", market: "US" },
  { ticker: "XLK", name: "Technology Select Sector SPDR", market: "US" },
  { ticker: "XLP", name: "Consumer Staples Select Sector SPDR", market: "US" },
  { ticker: "XLU", name: "Utilities Select Sector SPDR", market: "US" },
  { ticker: "XLV", name: "Health Care Select Sector SPDR", market: "US" },
  { ticker: "XLY", name: "Consumer Discretionary Select Sector SPDR", market: "US" },
  { ticker: "XOM", name: "ExxonMobil", market: "US" },
  { ticker: "XYL", name: "Xylem Inc.", market: "US" },
  { ticker: "XYZ", name: "Block, Inc.", market: "US" },
  { ticker: "YUM", name: "Yum! Brands", market: "US" },
  { ticker: "ZBH", name: "Zimmer Biomet", market: "US" },
  { ticker: "ZBRA", name: "Zebra Technologies", market: "US" },
  { ticker: "ZS", name: "ZSCALER, INC. CMN", market: "US" },
  { ticker: "ZTS", name: "Zoetis", market: "US" },

  // Indian Stocks
  { ticker: "ABB", name: "ABB India", market: "IN" },
  { ticker: "ADANIENSOL", name: "Adani Energy Solutions", market: "IN" },
  { ticker: "ADANIENT", name: "Adani Enterprises", market: "IN" },
  { ticker: "ADANIGREEN", name: "Adani Green Energy", market: "IN" },
  { ticker: "ADANIPORTS", name: "Adani Ports & SEZ", market: "IN" },
  { ticker: "ADANIPOWER", name: "Adani Power", market: "IN" },
  { ticker: "AMBUJACEM", name: "Ambuja Cements", market: "IN" },
  { ticker: "APOLLOHOSP", name: "Apollo Hospitals", market: "IN" },
  { ticker: "ASIANPAINT", name: "Asian Paints", market: "IN" },
  { ticker: "AXISBANK", name: "Axis Bank", market: "IN" },
  { ticker: "BAJAJ-AUTO", name: "Bajaj Auto", market: "IN" },
  { ticker: "BAJAJFINSV", name: "Bajaj Finserv", market: "IN" },
  { ticker: "BAJAJHLDNG", name: "Bajaj Holdings", market: "IN" },
  { ticker: "BAJFINANCE", name: "Bajaj Finance", market: "IN" },
  { ticker: "BANKBARODA", name: "Bank of Baroda", market: "IN" },
  { ticker: "BEL", name: "Bharat Electronics", market: "IN" },
  { ticker: "BHARTIARTL", name: "Bharti Airtel", market: "IN" },
  { ticker: "BOSCHLTD", name: "Bosch", market: "IN" },
  { ticker: "BPCL", name: "Bharat Petroleum", market: "IN" },
  { ticker: "BRITANNIA", name: "Britannia Industries", market: "IN" },
  { ticker: "CANBK", name: "Canara Bank", market: "IN" },
  { ticker: "CGPOWER", name: "CG Power and Industrial Solutions", market: "IN" },
  { ticker: "CHOLAFIN", name: "Cholamandalam", market: "IN" },
  { ticker: "CIPLA", name: "Cipla", market: "IN" },
  { ticker: "COALINDIA", name: "Coal India", market: "IN" },
  { ticker: "CUMMINSIND", name: "Cummins India", market: "IN" },
  { ticker: "DIVISLAB", name: "Divi's Laboratories", market: "IN" },
  { ticker: "DLF", name: "DLF", market: "IN" },
  { ticker: "DMART", name: "DMart", market: "IN" },
  { ticker: "DRREDDY", name: "Dr. Reddy's Laboratories", market: "IN" },
  { ticker: "EICHERMOT", name: "Eicher Motors", market: "IN" },
  { ticker: "ENRIN", name: "Siemens Energy", market: "IN" },
  { ticker: "ETERNAL", name: "Eternal", market: "IN" },
  { ticker: "GAIL", name: "GAIL", market: "IN" },
  { ticker: "GODREJCP", name: "Godrej Consumer Products", market: "IN" },
  { ticker: "GRASIM", name: "Grasim Industries", market: "IN" },
  { ticker: "HAL", name: "Hindustan Aeronautics", market: "IN" },
  { ticker: "HCLTECH", name: "HCLTech", market: "IN" },
  { ticker: "HDFCAMC", name: "HDFC Asset Management", market: "IN" },
  { ticker: "HDFCBANK", name: "HDFC Bank", market: "IN" },
  { ticker: "HDFCLIFE", name: "HDFC Life", market: "IN" },
  { ticker: "HINDALCO", name: "Hindalco Industries", market: "IN" },
  { ticker: "HINDUNILVR", name: "Hindustan Unilever", market: "IN" },
  { ticker: "HINDZINC", name: "Hindustan Zinc", market: "IN" },
  { ticker: "HYUNDAI", name: "Hyundai Motor India", market: "IN" },
  { ticker: "ICICIBANK", name: "ICICI Bank", market: "IN" },
  { ticker: "INDHOTEL", name: "Indian Hotels Company", market: "IN" },
  { ticker: "INDIGO", name: "IndiGo", market: "IN" },
  { ticker: "INFY", name: "Infosys", market: "IN" },
  { ticker: "IOC", name: "Indian Oil Corporation", market: "IN" },
  { ticker: "IRFC", name: "IRFC", market: "IN" },
  { ticker: "ITC", name: "ITC", market: "IN" },
  { ticker: "JINDALSTEL", name: "Jindal Steel", market: "IN" },
  { ticker: "JIOFIN", name: "Jio Financial Services", market: "IN" },
  { ticker: "JSWSTEEL", name: "JSW Steel", market: "IN" },
  { ticker: "KOTAKBANK", name: "Kotak Mahindra Bank", market: "IN" },
  { ticker: "LODHA", name: "Lodha", market: "IN" },
  { ticker: "LT", name: "Larsen & Toubro", market: "IN" },
  { ticker: "LTM", name: "LTM", market: "IN" },
  { ticker: "M&M", name: "Mahindra & Mahindra", market: "IN" },
  { ticker: "MARUTI", name: "Maruti Suzuki", market: "IN" },
  { ticker: "MAXHEALTH", name: "Max Healthcare", market: "IN" },
  { ticker: "MAZDOCK", name: "Mazagon Dock Shipbuilders", market: "IN" },
  { ticker: "MOTHERSON", name: "Samvardhana Motherson", market: "IN" },
  { ticker: "MUTHOOTFIN", name: "Muthoot Finance", market: "IN" },
  { ticker: "NESTLEIND", name: "Nestlé India", market: "IN" },
  { ticker: "NTPC", name: "NTPC", market: "IN" },
  { ticker: "ONGC", name: "Oil and Natural Gas Corporation", market: "IN" },
  { ticker: "PFC", name: "Power Finance Corporation", market: "IN" },
  { ticker: "PIDILITIND", name: "Pidilite Industries", market: "IN" },
  { ticker: "PNB", name: "Punjab National Bank", market: "IN" },
  { ticker: "POWERGRID", name: "Power Grid", market: "IN" },
  { ticker: "RECLTD", name: "REC", market: "IN" },
  { ticker: "RELIANCE", name: "Reliance Industries", market: "IN" },
  { ticker: "SBILIFE", name: "SBI Life Insurance Company", market: "IN" },
  { ticker: "SBIN", name: "State Bank of India", market: "IN" },
  { ticker: "SHREECEM", name: "Shree Cement", market: "IN" },
  { ticker: "SHRIRAMFIN", name: "Shriram Finance", market: "IN" },
  { ticker: "SIEMENS", name: "Siemens", market: "IN" },
  { ticker: "SOLARINDS", name: "Solar Industries", market: "IN" },
  { ticker: "SUNPHARMA", name: "Sun Pharma", market: "IN" },
  { ticker: "TATACAP", name: "Tata Capital", market: "IN" },
  { ticker: "TATACONSUM", name: "Tata Consumer Products", market: "IN" },
  { ticker: "TATAPOWER", name: "Tata Power", market: "IN" },
  { ticker: "TATASTEEL", name: "Tata Steel", market: "IN" },
  { ticker: "TCS", name: "Tata Consultancy Services", market: "IN" },
  { ticker: "TECHM", name: "Tech Mahindra", market: "IN" },
  { ticker: "TITAN", name: "Titan Company", market: "IN" },
  { ticker: "TMCV", name: "Tata Motors", market: "IN" },
  { ticker: "TMPV", name: "Tata Motors Passenger Vehicles", market: "IN" },
  { ticker: "TORNTPHARM", name: "Torrent Pharmaceuticals", market: "IN" },
  { ticker: "TRENT", name: "Trent", market: "IN" },
  { ticker: "TVSMOTOR", name: "TVS Motor Company", market: "IN" },
  { ticker: "ULTRACEMCO", name: "UltraTech Cement", market: "IN" },
  { ticker: "UNIONBANK", name: "Union Bank of India", market: "IN" },
  { ticker: "UNITDSPR", name: "United Spirits", market: "IN" },
  { ticker: "VBL", name: "Varun Beverages", market: "IN" },
  { ticker: "VEDL", name: "Vedanta", market: "IN" },
  { ticker: "WIPRO", name: "Wipro", market: "IN" },
  { ticker: "ZYDUSLIFE", name: "Zydus Lifesciences", market: "IN" },
];

interface InputPanelProps {
  initialInputs: PricingRequest;
  onInputsChange: (inputs: PricingRequest) => void;
  onPreviewSuccess: (result: PricingPreviewResponse) => void;
  onPreviewError: (error: ApiError | null) => void;
  onRunFullSimulation: (inputs: PricingRequest) => void;
  isFullSimulating: boolean;
  onMicroStateChange: (state: "pending" | "preview" | "error") => void;
}

export function InputPanel({
  initialInputs,
  onInputsChange,
  onPreviewSuccess,
  onPreviewError,
  onRunFullSimulation,
  isFullSimulating,
  onMicroStateChange,
}: InputPanelProps) {
  const [inputs, setInputs] = useState<PricingRequest>(initialInputs);
  const [seedLocked, setSeedLocked] = useState<boolean>(false);
  const [fetchingMarket, setFetchingMarket] = useState<boolean>(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [tickerTouched, setTickerTouched] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { density } = useDensity();

  // Debounce preview-triggering inputs (~200ms)
  const debouncedInputs = useDebounce(inputs, 200);

  // Request sequence ref & AbortController ref to prevent out-of-order race conditions
  const requestIdRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Helper to update a field in state and notify parent / update URL
  const updateField = useCallback(
    <K extends keyof PricingRequest>(field: K, value: PricingRequest[K]) => {
      setInputs((prev) => {
        const next = { ...prev, [field]: value };
        onInputsChange(next);

        // Update URL search query string dynamically without full page reload
        if (typeof window !== "undefined") {
          const queryStr = serializeInputs(next);
          const newUrl = `${window.location.pathname}?${queryStr}`;
          window.history.replaceState(null, "", newUrl);
        }
        return next;
      });
    },
    [onInputsChange]
  );

  // Filtered ticker suggestions for autocomplete — matches ticker symbol OR company name
  const filteredTickers = useMemo(() => {
    const q = inputs.ticker.toUpperCase().trim();
    if (!q) return [];
    return TICKER_DATABASE.filter(
      (t) =>
        t.market === inputs.market &&
        (t.ticker.startsWith(q) || t.name.toUpperCase().includes(q))
    ).slice(0, 10);
  }, [inputs.ticker, inputs.market]);

  const selectTicker = useCallback(
    (ticker: string) => {
      updateField("ticker", ticker);
      setShowDropdown(false);
      setTickerTouched(false);
      setActiveIndex(-1);
    },
    [updateField]
  );

  const handleTickerKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showDropdown || filteredTickers.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((prev) =>
            prev < filteredTickers.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((prev) =>
            prev > 0 ? prev - 1 : filteredTickers.length - 1
          );
          break;
        case "Enter":
          e.preventDefault();
          if (activeIndex >= 0 && activeIndex < filteredTickers.length) {
            selectTicker(filteredTickers[activeIndex].ticker);
          } else if (filteredTickers.length > 0) {
            selectTicker(filteredTickers[0].ticker);
          }
          break;
        case "Escape":
          setShowDropdown(false);
          setActiveIndex(-1);
          break;
      }
    },
    [showDropdown, filteredTickers, activeIndex, selectTicker]
  );

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Scroll focused dropdown item into view
  useEffect(() => {
    if (activeIndex >= 0 && dropdownRef.current) {
      const items = dropdownRef.current.querySelectorAll("[data-ticker-item]");
      items[activeIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  // Auto-fetch market quote when ticker or market changes
  const handleMarketFetch = async () => {
    if (!inputs.ticker.trim()) return;
    setFetchingMarket(true);
    try {
      const quote = await getMarketQuote(inputs.ticker, inputs.market);
      setInputs((prev) => {
        const next: PricingRequest = {
          ...prev,
          spot_override: quote.spot_price,
          volatility: quote.historical_volatility["252d"] || prev.volatility,
          dividend_yield: quote.dividend_yield,
        };
        onInputsChange(next);
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", `?${serializeInputs(next)}`);
        }
        return next;
      });
    } catch {
      // Ignore market fetch failure — manual spot override remains
    } finally {
      setFetchingMarket(false);
    }
  };

  // Preview Tier Debounce & Abort Effect
  useEffect(() => {
    // Increment request ID counter for this update
    requestIdRef.current += 1;
    const currentReqId = requestIdRef.current;

    // Abort previous in-flight preview request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Notify parent of pending micro-state
    onMicroStateChange("pending");

    // Preview request payload (capped N simulations for preview tier: max 20,000)
    const previewPayload: PricingRequest = {
      ...debouncedInputs,
      n_simulations: Math.min(debouncedInputs.n_simulations, 10000),
    };

    postPricePreview(previewPayload, controller.signal)
      .then((data) => {
        // Race condition check: ignore if superseded or aborted
        if (requestIdRef.current !== currentReqId || controller.signal.aborted) {
          return;
        }
        onPreviewSuccess(data);
        onPreviewError(null);
        onMicroStateChange("preview");
      })
      .catch((err) => {
        if (requestIdRef.current !== currentReqId || controller.signal.aborted) {
          return;
        }
        if (err instanceof ApiError) {
          onPreviewError(err);
        }
        onMicroStateChange("error");
      });

    return () => {
      controller.abort();
    };
  }, [debouncedInputs, onMicroStateChange, onPreviewError, onPreviewSuccess]);

  const handleRandomizeSeed = () => {
    if (seedLocked) return;
    const newSeed = Math.floor(Math.random() * 1000000);
    updateField("seed", newSeed);
  };

  return (
    <div className={`bg-slate-800/80 border border-slate-700 rounded-lg ${density === "compact" ? "p-4 space-y-4" : "p-6 space-y-6"}`}>
      <div className="flex items-center justify-between border-b border-slate-700 pb-3">
        <h2 className="text-lg font-bold text-white tracking-tight">
          Pricing Inputs
        </h2>
        <span className="text-xs text-slate-400 font-mono">
          Preview Auto-Debounced (~200ms)
        </span>
      </div>

      {/* 1. Underlying Ticker & Market Selection */}
      <div className="space-y-3">
        <label className="block text-xs font-bold uppercase tracking-wider text-cyan-400">
          Underlying Asset
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div ref={containerRef} className="sm:col-span-2 flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={inputs.ticker}
                onChange={(e) => {
                  updateField("ticker", e.target.value.toUpperCase());
                  setShowDropdown(true);
                  setTickerTouched(true);
                  setActiveIndex(-1);
                }}
                onKeyDown={handleTickerKeyDown}
                onFocus={() => {
                  setShowDropdown(true);
                  setTickerTouched(true);
                }}
                placeholder="Ticker (e.g. AAPL)"
                className="w-full bg-slate-950 border border-slate-700/50 rounded px-3 py-2 text-sm text-white font-mono"
              />
              {showDropdown && tickerTouched && inputs.ticker.trim() && (
                <div ref={dropdownRef} className="absolute top-full left-0 right-0 mt-1 bg-slate-950 border border-slate-700 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                  {filteredTickers.length > 0 ? (
                    <>
                      <div className="px-3 py-1.5 text-xs text-slate-400 font-mono border-b border-slate-800">
                        {filteredTickers.length} MATCH{filteredTickers.length !== 1 ? "ES" : ""}
                      </div>
                      {filteredTickers.map((entry, idx) => (
                        <div
                          key={entry.ticker}
                          data-ticker-item
                          onMouseDown={() => selectTicker(entry.ticker)}
                          className={`px-3 py-2 cursor-pointer flex items-center justify-between border-l-2 ${
                            idx === activeIndex
                              ? "bg-amber-950/60 border-amber-500 text-white"
                              : "text-slate-300 hover:bg-slate-800 border-transparent"
                          }`}
                        >
                          <div className="flex flex-col">
                            <span className="font-mono font-bold text-sm">{entry.ticker}</span>
                            <span className="text-xs text-slate-400">{entry.name}</span>
                          </div>
                          <span className="text-xs text-slate-400 font-mono bg-slate-800 px-1.5 py-0.5 rounded">{entry.market}</span>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="px-3 py-3 text-center">
                      <p className="text-xs text-slate-400">
                        No tickers match &ldquo;{inputs.ticker}&rdquo; in {inputs.market} market
                      </p>
                      <p className="text-xs text-slate-600 mt-1">
                        Try a different symbol or switch market
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleMarketFetch}
              disabled={fetchingMarket}
              className="bg-slate-700 hover:bg-slate-600 text-white text-xs px-3 py-2 rounded font-semibold transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {fetchingMarket ? "Syncing..." : "Sync Market"}
            </button>
          </div>

          <div className="flex bg-slate-950 p-1 rounded border border-slate-700">
            <button
              type="button"
              onClick={() => {
                updateField("market", "US");
                if (inputs.ticker.trim()) {
                  setTickerTouched(true);
                  setShowDropdown(true);
                } else {
                  setTickerTouched(false);
                  setShowDropdown(false);
                }
              }}
              className={`flex-1 py-1 text-xs font-semibold rounded transition-colors ${
                inputs.market === "US"
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              US
            </button>
            <button
              type="button"
              onClick={() => {
                updateField("market", "IN");
                if (inputs.ticker.trim()) {
                  setTickerTouched(true);
                  setShowDropdown(true);
                } else {
                  setTickerTouched(false);
                  setShowDropdown(false);
                }
              }}
              className={`flex-1 py-1 text-xs font-semibold rounded transition-colors ${
                inputs.market === "IN"
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              IN (.NS)
            </button>
          </div>
        </div>

        {/* Spot Price Override */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Spot Price ($S_0$)</label>
            <input
              type="number"
              step="0.01"
              value={inputs.spot_override ?? ""}
              onChange={(e) =>
                updateField("spot_override", e.target.value ? Number(e.target.value) : null)
              }
              placeholder="Market default"
              className="w-full bg-slate-950 border border-slate-700/50 rounded px-3 py-1.5 text-sm text-white font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Dividend Yield ($q$)</label>
            <input
              type="number"
              step="0.001"
              value={inputs.dividend_yield ?? 0}
              onChange={(e) => updateField("dividend_yield", Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700/50 rounded px-3 py-1.5 text-sm text-white font-mono"
            />
          </div>
        </div>
      </div>

      {/* 2. Option Type & Strike Price */}
      <div className="space-y-3 pt-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-cyan-400">
            Contract Terms
          </label>
          <div className="flex bg-slate-950 p-1 rounded border border-slate-700">
            <button
              type="button"
              onClick={() => updateField("option_type", "call")}
              className={`px-3 py-1 text-xs font-bold rounded transition-colors ${
                inputs.option_type === "call"
                  ? "bg-green-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              CALL
            </button>
            <button
              type="button"
              onClick={() => updateField("option_type", "put")}
              className={`px-3 py-1 text-xs font-bold rounded transition-colors ${
                inputs.option_type === "put"
                  ? "bg-red-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              PUT
            </button>
          </div>
        </div>

        {/* Strike Price Dual Input (Slider + Box) */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-slate-300">Strike Price ($K$)</label>
            <input
              type="number"
              step="0.5"
              value={inputs.strike}
              onChange={(e) => updateField("strike", Number(e.target.value))}
              className="w-24 bg-slate-950 border border-slate-700/50 rounded px-2 py-1 text-xs font-mono text-right text-white"
            />
          </div>
          <input
            type="range"
            min="10"
            max="1000"
            step="1"
            value={inputs.strike}
            onChange={(e) => updateField("strike", Number(e.target.value))}
            className="w-full accent-blue-500 cursor-pointer"
          />
        </div>

        {/* Expiry Date */}
        <div>
          <label className="block text-xs text-slate-300 mb-1">Expiration Date</label>
          <input
            type="date"
            value={inputs.expiry_date}
            onChange={(e) => updateField("expiry_date", e.target.value)}
            className="w-full bg-slate-950 border border-slate-700/50 rounded px-3 py-2 text-sm text-white font-mono"
          />
        </div>
      </div>

      {/* 3. Market Risk Parameters (Vol & Rate) */}
      <div className="space-y-3 pt-3">
        <label className="block text-xs font-bold uppercase tracking-wider text-cyan-400">
          Risk &amp; Volatility Parameters
        </label>

        {/* Volatility Dual Input */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-slate-300">
              Volatility ($\sigma$): {(inputs.volatility * 100).toFixed(1)}%
            </label>
            <input
              type="number"
              step="0.01"
              value={inputs.volatility}
              onChange={(e) => updateField("volatility", Number(e.target.value))}
              className="w-24 bg-slate-950 border border-slate-700/50 rounded px-2 py-1 text-xs font-mono text-right text-white"
            />
          </div>
          <input
            type="range"
            min="0.01"
            max="2.00"
            step="0.01"
            value={inputs.volatility}
            onChange={(e) => updateField("volatility", Number(e.target.value))}
            className="w-full accent-blue-500 cursor-pointer"
          />
        </div>

        {/* Risk-Free Rate Dual Input */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-slate-300">
              Risk-Free Rate ($r$): {(inputs.risk_free_rate * 100).toFixed(1)}%
            </label>
            <input
              type="number"
              step="0.005"
              value={inputs.risk_free_rate}
              onChange={(e) => updateField("risk_free_rate", Number(e.target.value))}
              className="w-24 bg-slate-950 border border-slate-700/50 rounded px-2 py-1 text-xs font-mono text-right text-white"
            />
          </div>
          <input
            type="range"
            min="-0.02"
            max="0.20"
            step="0.0025"
            value={inputs.risk_free_rate}
            onChange={(e) => updateField("risk_free_rate", Number(e.target.value))}
            className="w-full accent-blue-500 cursor-pointer"
          />
        </div>
      </div>

      {/* 4. Simulation Engine Controls */}
      <div className="space-y-3 pt-3">
        <label className="block text-xs font-bold uppercase tracking-wider text-cyan-400">
          Simulation Controls
        </label>

        {/* N Simulations Presets */}
        <div>
          <label className="block text-xs text-slate-300 mb-1">
            Simulations ($N$): {inputs.n_simulations.toLocaleString()}
          </label>
          <div className="grid grid-cols-5 gap-1 mb-2">
            {[10000, 50000, 100000, 500000, 1000000].map((nVal) => (
              <button
                key={nVal}
                type="button"
                onClick={() => updateField("n_simulations", nVal)}
                className={`py-1 text-xs font-mono rounded transition-colors ${
                  inputs.n_simulations === nVal
                    ? "bg-blue-600 text-white font-bold"
                    : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                }`}
              >
                {nVal >= 1000000 ? `${nVal / 1000000}M` : `${nVal / 1000}k`}
              </button>
            ))}
          </div>
          <input
            type="range"
            min="1000"
            max="2000000"
            step="5000"
            value={inputs.n_simulations}
            onChange={(e) => updateField("n_simulations", Number(e.target.value))}
            className="w-full accent-blue-500 cursor-pointer"
          />
        </div>

        {/* Variance Reduction Selector */}
        <div>
          <label className="block text-xs text-slate-300 mb-1">Variance Reduction Method</label>
          <select
            value={inputs.variance_reduction}
            onChange={(e) =>
              updateField("variance_reduction", e.target.value as VarianceReductionMethod)
            }
            className="w-full bg-slate-950 border border-slate-700/50 rounded px-3 py-2 text-xs font-mono text-white"
          >
            <option value="all">All 4 Estimators (Standard / Anti / CV / Combined)</option>
            <option value="standard">Standard Monte Carlo</option>
            <option value="antithetic">Antithetic Variates</option>
            <option value="control_variate">Control Variates (S_T)</option>
            <option value="antithetic_cv">Combined Antithetic + CV</option>
          </select>
        </div>

        {/* Seed Control (Randomize + Lock Button) */}
        <div>
          <label className="block text-xs text-slate-300 mb-1">RNG Seed</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={inputs.seed}
              disabled={seedLocked}
              onChange={(e) => updateField("seed", Number(e.target.value))}
              className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs font-mono text-white disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleRandomizeSeed}
              disabled={seedLocked}
              className="bg-slate-700 hover:bg-slate-600 text-white text-xs px-3 py-1.5 rounded font-mono disabled:opacity-50"
            >
              Randomize
            </button>
            <button
              type="button"
              onClick={() => setSeedLocked(!seedLocked)}
              className={`text-xs px-3 py-1.5 rounded font-mono border transition-colors ${
                seedLocked
                  ? "bg-amber-950 border-amber-700 text-amber-300"
                  : "bg-slate-900 border-slate-700 text-slate-400 hover:text-white"
              }`}
            >
              {seedLocked ? "Locked" : "Unlocked"}
            </button>
          </div>
        </div>
      </div>

      {/* 5. Primary CTA: Run Full Simulation Button */}
      <div className="pt-4">
        <button
          type="button"
          disabled={isFullSimulating}
          onClick={() => onRunFullSimulation(inputs)}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm py-3.5 px-4 rounded-lg shadow-lg shadow-blue-900/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          <span>{isFullSimulating ? "Simulating..." : "▶ Run Full Simulation"}</span>
          <span className="text-xs font-mono text-blue-200">(N={inputs.n_simulations.toLocaleString()})</span>
        </button>
        <p className="text-[10px] text-slate-500 text-center mt-1.5 font-mono">Ctrl+Enter</p>
      </div>
    </div>
  );
}
